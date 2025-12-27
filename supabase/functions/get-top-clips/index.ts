import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { language = 'es', limit = 50 } = await req.json().catch(() => ({}));
    
    const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID');
    const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET');

    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      throw new Error('Twitch credentials not configured');
    }

    // Get OAuth token
    console.log('Getting Twitch OAuth token...');
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Failed to get Twitch access token');
    }

    const startedAt = new Date();
    startedAt.setHours(startedAt.getHours() - 24);

    // Get top games
    console.log('Fetching top games...');
    const gamesResponse = await fetch(
      'https://api.twitch.tv/helix/games/top?first=20',
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    const gamesData = await gamesResponse.json();
    console.log('Found games:', gamesData.data?.length);
    
    const allClips: any[] = [];
    const broadcasterIds = new Set<string>();
    
    // Get clips from each top game
    for (const game of gamesData.data || []) {
      try {
        const gameClipsResponse = await fetch(
          `https://api.twitch.tv/helix/clips?game_id=${game.id}&first=50&started_at=${startedAt.toISOString()}`,
          {
            headers: {
              'Client-ID': TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        const gameClipsData = await gameClipsResponse.json();
        if (gameClipsData.data) {
          for (const clip of gameClipsData.data) {
            allClips.push({
              ...clip,
              game_name: game.name,
            });
            broadcasterIds.add(clip.broadcaster_id);
          }
        }
      } catch (e) {
        console.error(`Error fetching clips for game ${game.name}:`, e);
      }
    }
    
    console.log('Total clips fetched:', allClips.length);
    console.log('Unique broadcasters:', broadcasterIds.size);
    
    // Get broadcaster info to filter by language
    const broadcasterIdsArray = Array.from(broadcasterIds);
    const broadcasterLanguages: Record<string, string> = {};
    
    // Fetch broadcaster info in batches of 100
    for (let i = 0; i < broadcasterIdsArray.length; i += 100) {
      const batch = broadcasterIdsArray.slice(i, i + 100);
      const idsParam = batch.map(id => `id=${id}`).join('&');
      
      try {
        const usersResponse = await fetch(
          `https://api.twitch.tv/helix/users?${idsParam}`,
          {
            headers: {
              'Client-ID': TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        const usersData = await usersResponse.json();
        
        // Now get channels to get broadcaster language
        const channelsResponse = await fetch(
          `https://api.twitch.tv/helix/channels?${idsParam}`,
          {
            headers: {
              'Client-ID': TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        const channelsData = await channelsResponse.json();
        
        for (const channel of channelsData.data || []) {
          broadcasterLanguages[channel.broadcaster_id] = channel.broadcaster_language;
        }
      } catch (e) {
        console.error('Error fetching broadcaster info:', e);
      }
    }
    
    console.log('Broadcaster languages fetched');
    
    // Filter clips by language
    const filteredClips = allClips.filter(clip => {
      const lang = broadcasterLanguages[clip.broadcaster_id];
      if (language === 'all') return true;
      return lang === language;
    });
    
    console.log(`Clips in ${language}:`, filteredClips.length);
    
    // Sort by view count and take top clips
    filteredClips.sort((a, b) => b.view_count - a.view_count);
    const topClips = filteredClips.slice(0, limit);
    
    const formattedClips = topClips.map((clip: any) => ({
      id: clip.id,
      title: clip.title,
      broadcaster_name: clip.broadcaster_name,
      game_name: clip.game_name || 'Unknown',
      thumbnail_url: clip.thumbnail_url,
      view_count: clip.view_count,
      duration: clip.duration,
      created_at: clip.created_at,
      url: clip.url,
      embed_url: clip.embed_url,
      language: broadcasterLanguages[clip.broadcaster_id] || 'unknown',
    }));

    return new Response(
      JSON.stringify({
        success: true,
        clips: formattedClips,
        totalFound: filteredClips.length,
        language: language,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching top clips:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
