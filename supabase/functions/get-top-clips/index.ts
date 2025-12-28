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
    const { language = 'es', limit = 20, cursor, gameId } = await req.json().catch(() => ({}));
    
    console.log(`Fetching clips - language: ${language}, limit: ${limit}, cursor: ${cursor}, gameId: ${gameId}`);
    
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

    // Get top games for the filter dropdown
    console.log('Fetching top games...');
    const gamesResponse = await fetch(
      'https://api.twitch.tv/helix/games/top?first=50',
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    const gamesData = await gamesResponse.json();
    const topGames = gamesData.data || [];
    console.log('Found games:', topGames.length);
    
    // Determine which games to fetch clips from - limit to 10 games and 5 pages each for faster response
    const gamesToFetch = gameId 
      ? [{ id: gameId, name: topGames.find((g: any) => g.id === gameId)?.name || 'Unknown' }]
      : topGames.slice(0, 10);
    
    const allClips: any[] = [];
    const broadcasterIds = new Set<string>();
    const seenClipIds = new Set<string>();
    const MAX_PAGES_PER_GAME = gameId ? 20 : 5; // More pages when filtering by specific game
    
    // Get clips from each game with pagination (up to 100 pages per game)
    for (const game of gamesToFetch) {
      let gameCursor: string | undefined;
      let pageCount = 0;
      
      try {
        while (pageCount < MAX_PAGES_PER_GAME) {
          const url = new URL('https://api.twitch.tv/helix/clips');
          url.searchParams.set('game_id', game.id);
          url.searchParams.set('first', '100');
          url.searchParams.set('started_at', startedAt.toISOString());
          if (gameCursor) {
            url.searchParams.set('after', gameCursor);
          }
          
          const gameClipsResponse = await fetch(url.toString(), {
            headers: {
              'Client-ID': TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${accessToken}`,
            },
          });
          
          const gameClipsData = await gameClipsResponse.json();
          
          if (!gameClipsData.data || gameClipsData.data.length === 0) {
            break;
          }
          
          for (const clip of gameClipsData.data) {
            if (!seenClipIds.has(clip.id)) {
              seenClipIds.add(clip.id);
              allClips.push({
                ...clip,
                game_name: game.name,
              });
              broadcasterIds.add(clip.broadcaster_id);
            }
          }
          
          pageCount++;
          gameCursor = gameClipsData.pagination?.cursor;
          
          if (!gameCursor) {
            break;
          }
          
          console.log(`Game ${game.name}: page ${pageCount}, total clips: ${allClips.length}`);
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
      const idsParam = batch.map(id => `broadcaster_id=${id}`).join('&');
      
      try {
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
    console.log('Sample languages:', Object.values(broadcasterLanguages).slice(0, 10));
    
    // Filter clips by language
    const filteredClips = allClips.filter(clip => {
      const lang = broadcasterLanguages[clip.broadcaster_id];
      if (language === 'all') return true;
      if (language === 'es') {
        return lang && (lang === 'es' || lang.startsWith('es-') || lang === 'spanish');
      }
      return lang === language;
    });
    
    console.log(`Clips in ${language}:`, filteredClips.length);
    
    // Sort by view count
    filteredClips.sort((a, b) => b.view_count - a.view_count);
    
    // Parse cursor for pagination (cursor is the start index)
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + limit;
    const paginatedClips = filteredClips.slice(startIndex, endIndex);
    const nextCursor = endIndex < filteredClips.length ? endIndex.toString() : null;
    
    const formattedClips = paginatedClips.map((clip: any) => ({
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
        games: topGames.map((g: any) => ({ id: g.id, name: g.name })),
        totalFound: filteredClips.length,
        nextCursor,
        language,
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
