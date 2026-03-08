import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getTwitchToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get Twitch token');
  return data.access_token;
}

function extractClipSlug(url: string): string | null {
  // Handle formats:
  // https://clips.twitch.tv/SlugHere
  // https://www.twitch.tv/channel/clip/SlugHere
  // https://twitch.tv/channel/clip/SlugHere
  // Or just the slug directly
  const trimmed = url.trim();

  // clips.twitch.tv/SLUG
  const clipsMatch = trimmed.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)/);
  if (clipsMatch) return clipsMatch[1];

  // twitch.tv/channel/clip/SLUG
  const channelClipMatch = trimmed.match(/twitch\.tv\/[^/]+\/clip\/([A-Za-z0-9_-]+)/);
  if (channelClipMatch) return channelClipMatch[1];

  // If it looks like a raw slug (no slashes, no spaces)
  if (/^[A-Za-z0-9_-]+$/.test(trimmed) && trimmed.length > 5) {
    return trimmed;
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clipUrl } = await req.json();

    if (!clipUrl) {
      return new Response(JSON.stringify({ error: 'clipUrl is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const slug = extractClipSlug(clipUrl);
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Could not extract clip ID from URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID')!;
    const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET')!;

    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      throw new Error('Twitch credentials not configured');
    }

    const token = await getTwitchToken(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);

    // Fetch clip info
    const clipRes = await fetch(`https://api.twitch.tv/helix/clips?id=${slug}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`,
      },
    });
    const clipData = await clipRes.json();

    if (!clipData.data || clipData.data.length === 0) {
      return new Response(JSON.stringify({ error: 'Clip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clip = clipData.data[0];

    // Get game info
    let gameName = clip.game_id ? 'Unknown' : '';
    if (clip.game_id) {
      const gameRes = await fetch(`https://api.twitch.tv/helix/games?id=${clip.game_id}`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
        },
      });
      const gameData = await gameRes.json();
      if (gameData.data && gameData.data.length > 0) {
        gameName = gameData.data[0].name;
      }
    }

    // Build download URL from thumbnail
    // Twitch clip thumbnails follow pattern: ...-preview-480x272.jpg
    // The actual video is at the same base URL but with .mp4
    const thumbnailUrl = clip.thumbnail_url || '';
    const videoBaseUrl = thumbnailUrl.replace(/-preview-\d+x\d+\.jpg.*$/, '.mp4');

    const result = {
      title: clip.title,
      streamer: clip.broadcaster_name,
      game: gameName,
      createdAt: clip.created_at,
      duration: clip.duration,
      viewCount: clip.view_count,
      thumbnailUrl: clip.thumbnail_url,
      embedUrl: clip.embed_url,
      clipUrl: clip.url,
      videoUrl: videoBaseUrl,
      qualities: [
        { label: 'Original (1080p60)', url: videoBaseUrl },
        { label: '720p', url: videoBaseUrl + '?quality=720' },
        { label: '480p', url: videoBaseUrl + '?quality=480' },
        { label: '360p', url: videoBaseUrl + '?quality=360' },
      ],
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
