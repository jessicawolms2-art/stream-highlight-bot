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

    // Get top clips from last 24 hours
    // Twitch API returns clips sorted by view count by default
    const startedAt = new Date();
    startedAt.setHours(startedAt.getHours() - 24);
    
    console.log('Fetching top clips from last 24 hours...');
    const clipsResponse = await fetch(
      `https://api.twitch.tv/helix/clips?first=20&started_at=${startedAt.toISOString()}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    const clipsData = await clipsResponse.json();
    console.log('Clips response:', JSON.stringify(clipsData).slice(0, 500));

    if (!clipsData.data || clipsData.data.length === 0) {
      // Si no hay clips con ese endpoint, intentar con juegos populares
      console.log('No clips found, trying with top games...');
      
      // Get top games
      const gamesResponse = await fetch(
        'https://api.twitch.tv/helix/games/top?first=5',
        {
          headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      const gamesData = await gamesResponse.json();
      const allClips: any[] = [];
      
      // Get clips from each top game
      for (const game of gamesData.data || []) {
        const gameClipsResponse = await fetch(
          `https://api.twitch.tv/helix/clips?game_id=${game.id}&first=10&started_at=${startedAt.toISOString()}`,
          {
            headers: {
              'Client-ID': TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        const gameClipsData = await gameClipsResponse.json();
        if (gameClipsData.data) {
          allClips.push(...gameClipsData.data.map((clip: any) => ({
            ...clip,
            game_name: game.name,
          })));
        }
      }
      
      // Sort by view count and take top 20
      allClips.sort((a, b) => b.view_count - a.view_count);
      const topClips = allClips.slice(0, 20);
      
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
      }));

      return new Response(
        JSON.stringify({
          success: true,
          clips: formattedClips,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Format clips data
    const formattedClips = clipsData.data.map((clip: any) => ({
      id: clip.id,
      title: clip.title,
      broadcaster_name: clip.broadcaster_name,
      game_name: clip.game_id, // Will need to fetch game names separately for better UX
      thumbnail_url: clip.thumbnail_url,
      view_count: clip.view_count,
      duration: clip.duration,
      created_at: clip.created_at,
      url: clip.url,
      embed_url: clip.embed_url,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        clips: formattedClips,
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
