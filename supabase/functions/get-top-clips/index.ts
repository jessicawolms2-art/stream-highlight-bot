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
    const body = await req.json().catch(() => ({}));
    const { 
      action, query, 
      // Support both old single values and new arrays
      language, languages,
      limit = 20, cursor, 
      gameId, gameIds,
      timeFilter = '24h', 
      broadcasterName, broadcasterNames 
    } = body;
    
    // Normalize to arrays
    const langList: string[] = languages || (language ? [language] : ['es']);
    const gameIdList: string[] = gameIds || (gameId && gameId !== 'all' ? [gameId] : []);
    const broadcasterNameList: string[] = broadcasterNames || (broadcasterName ? [broadcasterName] : []);
    
    const TWITCH_CLIENT_ID = Deno.env.get('TWITCH_CLIENT_ID');
    const TWITCH_CLIENT_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET');

    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      throw new Error('Twitch credentials not configured');
    }

    // Get OAuth token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error('Failed to get Twitch access token');

    const twitchHeaders = {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${accessToken}`,
    };

    // Handle channel search
    if (action === 'search_channels' && query) {
      const searchUrl = `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query)}&first=10&live_only=false`;
      const searchResponse = await fetch(searchUrl, { headers: twitchHeaders });
      const searchData = await searchResponse.json();
      
      const channels = (searchData.data || []).map((ch: any) => ({
        id: ch.id, broadcaster_login: ch.broadcaster_login,
        display_name: ch.display_name, thumbnail_url: ch.thumbnail_url,
        is_live: ch.is_live, game_name: ch.game_name || '',
        title: ch.title || '', started_at: ch.started_at || '',
      }));
      
      return new Response(
        JSON.stringify({ success: true, channels }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate time range
    const timeFilterHours: Record<string, number> = {
      '1h': 1, '2h': 2, '3h': 3, '6h': 6, '12h': 12, '24h': 24, '3d': 72, '7d': 168, '30d': 720,
    };
    const hoursBack = timeFilterHours[timeFilter] || 24;
    const startedAt = new Date();
    startedAt.setHours(startedAt.getHours() - hoursBack);

    // Get top games
    const gamesResponse = await fetch('https://api.twitch.tv/helix/games/top?first=50', { headers: twitchHeaders });
    const gamesData = await gamesResponse.json();
    const topGames = gamesData.data || [];

    console.log(`Fetching clips - languages: ${langList}, gameIds: ${gameIdList}, timeFilter: ${timeFilter}, broadcasters: ${broadcasterNameList}`);

    // If filtering by broadcasters, resolve all broadcaster IDs
    if (broadcasterNameList.length > 0) {
      const allClips: any[] = [];
      
      // Resolve all broadcaster IDs in parallel
      const broadcasterPromises = broadcasterNameList.map(async (name: string) => {
        const searchUrl = `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(name)}&first=1`;
        const searchResponse = await fetch(searchUrl, { headers: twitchHeaders });
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          const exactMatch = searchData.data.find((ch: any) => 
            ch.broadcaster_login.toLowerCase() === name.toLowerCase() ||
            ch.display_name.toLowerCase() === name.toLowerCase()
          );
          return exactMatch?.id || searchData.data[0].id;
        }
        return null;
      });
      
      const broadcasterIds = (await Promise.all(broadcasterPromises)).filter(Boolean) as string[];
      
      // Fetch clips from all broadcasters in parallel
      const clipPromises = broadcasterIds.map(async (bId: string) => {
        const clips: any[] = [];
        let clipCursor: string | undefined;
        for (let page = 0; page < 10; page++) {
          const url = new URL('https://api.twitch.tv/helix/clips');
          url.searchParams.set('broadcaster_id', bId);
          url.searchParams.set('first', '100');
          url.searchParams.set('started_at', startedAt.toISOString());
          if (clipCursor) url.searchParams.set('after', clipCursor);
          
          const resp = await fetch(url.toString(), { headers: twitchHeaders });
          const data = await resp.json();
          if (!data.data || data.data.length === 0) break;
          
          for (const clip of data.data) {
            clips.push({ ...clip, game_name: topGames.find((g: any) => g.id === clip.game_id)?.name || 'Unknown' });
          }
          clipCursor = data.pagination?.cursor;
          if (!clipCursor) break;
        }
        return clips;
      });
      
      const results = await Promise.all(clipPromises);
      for (const clips of results) allClips.push(...clips);
      
      // Filter by gameIds if specified
      let filtered = allClips;
      if (gameIdList.length > 0) {
        filtered = filtered.filter(c => gameIdList.includes(c.game_id));
      }
      
      filtered.sort((a, b) => b.view_count - a.view_count);
      
      const startIndex = cursor ? parseInt(cursor, 10) : 0;
      const endIndex = startIndex + limit;
      const paginatedClips = filtered.slice(startIndex, endIndex);
      const nextCursor = endIndex < filtered.length ? endIndex.toString() : null;
      
      const formattedClips = paginatedClips.map((clip: any) => ({
        id: clip.id, title: clip.title, broadcaster_name: clip.broadcaster_name,
        game_name: clip.game_name || 'Unknown', thumbnail_url: clip.thumbnail_url,
        view_count: clip.view_count, duration: clip.duration, created_at: clip.created_at,
        url: clip.url, embed_url: clip.embed_url, language: 'unknown',
      }));

      return new Response(
        JSON.stringify({
          success: true, clips: formattedClips,
          games: topGames.map((g: any) => ({ id: g.id, name: g.name })),
          totalFound: filtered.length, nextCursor, language: langList,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // General clip fetching
    const gamesToFetch = gameIdList.length > 0
      ? gameIdList.map(id => ({ id, name: topGames.find((g: any) => g.id === id)?.name || 'Unknown' }))
      : topGames.slice(0, 40);
    
    const allClips: any[] = [];
    const broadcasterIds = new Set<string>();
    const seenClipIds = new Set<string>();
    
    const startTime = Date.now();
    const TIME_BUDGET_MS = 22000;
    const MAX_PAGES_PER_GAME = gameIdList.length > 0 ? 20 : 5;
    const MAX_TOTAL_CLIPS = 5000;
    const BATCH_SIZE = 5;
    
    for (let batchStart = 0; batchStart < gamesToFetch.length; batchStart += BATCH_SIZE) {
      if (Date.now() - startTime > TIME_BUDGET_MS || allClips.length >= MAX_TOTAL_CLIPS) break;
      
      const gameBatch = gamesToFetch.slice(batchStart, batchStart + BATCH_SIZE);
      
      const batchPromises = gameBatch.map(async (game: { id: string; name: string }) => {
        const gameClips: any[] = [];
        let gameCursor: string | undefined;
        let pageCount = 0;
        
        try {
          while (pageCount < MAX_PAGES_PER_GAME) {
            if (Date.now() - startTime > TIME_BUDGET_MS) break;
            
            const url = new URL('https://api.twitch.tv/helix/clips');
            url.searchParams.set('game_id', game.id);
            url.searchParams.set('first', '100');
            url.searchParams.set('started_at', startedAt.toISOString());
            if (gameCursor) url.searchParams.set('after', gameCursor);
            
            const resp = await fetch(url.toString(), { headers: twitchHeaders });
            const data = await resp.json();
            if (!data.data || data.data.length === 0) break;
            
            for (const clip of data.data) gameClips.push({ ...clip, game_name: game.name });
            pageCount++;
            gameCursor = data.pagination?.cursor;
            if (!gameCursor) break;
          }
        } catch (e) {
          console.error(`Error fetching clips for game ${game.name}:`, e);
        }
        return gameClips;
      });
      
      const batchResults = await Promise.all(batchPromises);
      for (const gameClips of batchResults) {
        for (const clip of gameClips) {
          if (!seenClipIds.has(clip.id)) {
            seenClipIds.add(clip.id);
            allClips.push(clip);
            broadcasterIds.add(clip.broadcaster_id);
          }
        }
      }
    }
    
    console.log('Total clips fetched:', allClips.length);
    
    // Get broadcaster languages
    const broadcasterIdsArray = Array.from(broadcasterIds);
    const broadcasterLanguages: Record<string, string> = {};
    
    for (let i = 0; i < broadcasterIdsArray.length; i += 100) {
      const batch = broadcasterIdsArray.slice(i, i + 100);
      const idsParam = batch.map(id => `broadcaster_id=${id}`).join('&');
      try {
        const resp = await fetch(`https://api.twitch.tv/helix/channels?${idsParam}`, { headers: twitchHeaders });
        const data = await resp.json();
        for (const channel of data.data || []) {
          broadcasterLanguages[channel.broadcaster_id] = channel.broadcaster_language;
        }
      } catch (e) {
        console.error('Error fetching broadcaster info:', e);
      }
    }
    
    // Filter by languages (support multiple)
    const filteredClips = allClips.filter(clip => {
      const lang = broadcasterLanguages[clip.broadcaster_id];
      if (langList.includes('all') || langList.length === 0) return true;
      if (!lang) return false;
      return langList.some(l => {
        if (l === 'es') return lang === 'es' || lang.startsWith('es-') || lang === 'spanish';
        return lang === l;
      });
    });
    
    console.log(`Clips in ${langList}:`, filteredClips.length);
    
    filteredClips.sort((a, b) => b.view_count - a.view_count);
    
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + limit;
    const paginatedClips = filteredClips.slice(startIndex, endIndex);
    const nextCursor = endIndex < filteredClips.length ? endIndex.toString() : null;
    
    const formattedClips = paginatedClips.map((clip: any) => ({
      id: clip.id, title: clip.title, broadcaster_name: clip.broadcaster_name,
      game_name: clip.game_name || 'Unknown', thumbnail_url: clip.thumbnail_url,
      view_count: clip.view_count, duration: clip.duration, created_at: clip.created_at,
      url: clip.url, embed_url: clip.embed_url,
      language: broadcasterLanguages[clip.broadcaster_id] || 'unknown',
    }));

    return new Response(
      JSON.stringify({
        success: true, clips: formattedClips,
        games: topGames.map((g: any) => ({ id: g.id, name: g.name })),
        totalFound: filteredClips.length, nextCursor, language: langList,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching top clips:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
