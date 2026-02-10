import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KickClip {
  id: string;
  title: string;
  thumbnail_url: string;
  clip_url: string;
  views: number;
  duration: number;
  created_at: string;
  category: { id: number; name: string; slug: string; };
  creator: { username: string; };
  channel: { username: string; slug: string; };
}

const kickHeaders = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { 
      action, query,
      categorySlug, categorySlugs,
      sortBy = 'view', timeFilter = 'week', 
      limit = 20, cursor, 
      language = 'es', languages,
      streamerNames,
    } = body;
    
    // Normalize
    const catList: string[] = categorySlugs || (categorySlug && categorySlug !== 'all' ? [categorySlug] : []);
    const langList: string[] = languages || (language ? [language] : ['es']);
    const streamerList: string[] = streamerNames || [];
    
    // Handle channel search
    if (action === 'search_channels' && query) {
      console.log(`Searching Kick channels for: ${query}`);
      try {
        const searchUrl = `https://kick.com/api/v2/search?query=${encodeURIComponent(query)}`;
        const searchResponse = await fetch(searchUrl, { headers: kickHeaders });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const channels = (searchData.channels || []).map((ch: any) => ({
            id: ch.id, slug: ch.slug || ch.channel_slug,
            username: ch.user?.username || ch.slug || query,
            profile_pic: ch.user?.profile_pic || ch.profile_pic || '',
            is_live: ch.livestream !== null,
            viewer_count: ch.livestream?.viewer_count || 0,
            category: ch.livestream?.categories?.[0]?.name || ch.recent_categories?.[0]?.name || '',
          }));
          return new Response(
            JSON.stringify({ success: true, channels }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const directUrl = `https://kick.com/api/v2/channels/${query.toLowerCase()}`;
        const directResponse = await fetch(directUrl, { headers: kickHeaders });
        if (directResponse.ok) {
          const ch = await directResponse.json();
          return new Response(
            JSON.stringify({ success: true, channels: [{
              id: ch.id, slug: ch.slug, username: ch.user?.username || ch.slug,
              profile_pic: ch.user?.profile_pic || '', is_live: ch.livestream !== null,
              viewer_count: ch.livestream?.viewer_count || 0,
              category: ch.livestream?.categories?.[0]?.name || '',
            }] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true, channels: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, channels: [], error: 'Search failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log(`Fetching Kick clips - categories: ${catList}, sort: ${sortBy}, time: ${timeFilter}, languages: ${langList}, streamers: ${streamerList}`);
    
    const allClips: any[] = [];
    const seenClipIds = new Set<string>();
    const categoriesSet = new Map<string, string>();
    
    // Viral streamers list
    const viralStreamers = [
      'ishowspeed', 'kaicenat', 'xqc', 'adin', 'adinross', 'sketch', 'jynxzi',
      'caseoh', 'caseoh_', 'nickmercs', 'hasanabi', 'amouranth', 'pokimane',
      'tenz', 'shroud', 'ninja', 'tfue', 'faze_swagg', 'clix', 'ronaldo',
      'trainwreckstv', 'roshtein', 'stakef1red', 'corinnakopf', 'mizkif',
      'nmplol', 'sodapoppin', 'erobb221', 'emiru', 'fanfan', 'valkyrae',
      'disguisedtoast', 'sykkuno', 'fuslie', 'lilypichu', 'qtcinderella',
      'moistcr1tikal', 'ludwig', 'atrioc', 'clintstevens', 'yassuo',
      'lacy', 'plaqueboymax', 'duke_dennis', 'agent00', 'yourragegaming',
      'auronplay', 'ibai', 'elxokas', 'illojuan', 'rubius', 'thegrefg', 
      'juansguarnizo', 'rivers_gg', 'westcol', 'arigameplays', 'elmariana',
      'fernanfloo', 'ded', 'roier', 'quackity', 'vegetta777',
      'alexby11', 'willyrex', 'ampeterby7', 'elded', 'gerardromero', 
      'davidguapo', 'jordiwild', 'llados', 'cheeto', 'zeling', 'werlyb',
      'knekro', 'reborn', 'mayichi', 'jaggerprincesa', 'carola', 'cristinini',
      'silithur', 'byviruzz', 'paracetamor', 'zorman', 'mrgranbomba',
      'elmillor', 'spreen', 'coscu', 'momo', 'frankkaster',
      'biyin', 'orslok', 'perxitaa', 'elspsjordi', 'djmariio',
      'ibelky', 'elvisitoo', 'xfarganx', 'shadoune666', 'kenai',
      'luzugames', 'staxx', 'windygirk', 'axozer', 'montanito',
      'rakon', 'fargan', 'wismichu', 'lolito', 'polispol', 'folagor',
      'mangelrogel', 'duxo', 'luzu', 'town', 'danirep',
      'coscu', 'robleis', 'demente', 'juegagerman',
      'werevertumorro', 'luisitocomunica', 'dross', 'thedonato',
      'sneako', 'piratesoftware', 'theprimeagen',
      'timthetatman', 'summit1g', 'lirik', 'cohhcarnage',
      'moonmoon', 'forsen', 'nymn', 'esfand', 'tectone'
    ];
    
    // Time mapping
    const getTimeParam = (filter: string): { kickTime: string; hoursLimit: number } => {
      const map: Record<string, { kickTime: string; hoursLimit: number }> = {
        '1h': { kickTime: 'day', hoursLimit: 1 }, '2h': { kickTime: 'day', hoursLimit: 2 },
        '3h': { kickTime: 'day', hoursLimit: 3 }, '4h': { kickTime: 'day', hoursLimit: 4 },
        '6h': { kickTime: 'day', hoursLimit: 6 }, '12h': { kickTime: 'day', hoursLimit: 12 },
        'day': { kickTime: 'day', hoursLimit: 24 }, '2days': { kickTime: 'week', hoursLimit: 48 },
        '3days': { kickTime: 'week', hoursLimit: 72 }, 'week': { kickTime: 'week', hoursLimit: 168 },
        '2weeks': { kickTime: 'month', hoursLimit: 336 }, 'month': { kickTime: 'month', hoursLimit: 720 },
        'all': { kickTime: 'all', hoursLimit: 999999 },
      };
      return map[filter] || { kickTime: 'week', hoursLimit: 168 };
    };
    
    const timeParams = getTimeParam(timeFilter);
    console.log(`Time filter: ${timeFilter} -> Kick API: ${timeParams.kickTime}, Max hours: ${timeParams.hoursLimit}`);
    
    const isWithinTimeLimit = (createdAt: string): boolean => {
      if (!createdAt) return false;
      try {
        const clipDate = new Date(createdAt);
        if (isNaN(clipDate.getTime())) return false;
        const diffHours = (new Date().getTime() - clipDate.getTime()) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= timeParams.hoursLimit;
      } catch { return false; }
    };
    
    const getSortParam = (sort: string): string => sort === 'recent' ? 'date' : 'view';
    
    // If specific streamers requested, fetch from those
    if (streamerList.length > 0) {
      console.log(`Fetching clips from specific streamers: ${streamerList}`);
      const streamerPromises = streamerList.map(async (streamer: string) => {
        try {
          const clipsUrl = `https://kick.com/api/v2/channels/${streamer}/clips?sort=${getSortParam(sortBy)}&time=${timeParams.kickTime}`;
          const response = await fetch(clipsUrl, { headers: kickHeaders });
          if (response.ok) {
            const data = await response.json();
            return (data.clips || []).filter((clip: any) => isWithinTimeLimit(clip.created_at));
          }
          return [];
        } catch { return []; }
      });
      
      const results = await Promise.all(streamerPromises);
      for (const clips of results) {
        for (const clip of clips) {
          const clipId = clip.id || clip.clip_id;
          if (!seenClipIds.has(clipId)) {
            seenClipIds.add(clipId);
            allClips.push(clip);
            if (clip.category) categoriesSet.set(clip.category.slug, clip.category.name);
          }
        }
      }
      console.log(`Fetched ${allClips.length} clips from specified streamers`);
    }
    
    // Fetch from viral streamers if Spanish is in selected languages
    if (streamerList.length === 0 && (langList.includes('es') || langList.includes('all') || langList.length === 0)) {
      console.log('Fetching clips from viral streamers...');
      const streamerPromises = viralStreamers.slice(0, 150).map(async (streamer: string) => {
        try {
          const clipsUrl = `https://kick.com/api/v2/channels/${streamer}/clips?sort=${getSortParam(sortBy)}&time=${timeParams.kickTime}`;
          const response = await fetch(clipsUrl, { headers: kickHeaders });
          if (response.ok) {
            const data = await response.json();
            return (data.clips || []).filter((clip: any) => isWithinTimeLimit(clip.created_at));
          }
          return [];
        } catch { return []; }
      });
      
      const results = await Promise.all(streamerPromises);
      for (const clips of results) {
        for (const clip of clips) {
          const clipId = clip.id || clip.clip_id;
          if (!seenClipIds.has(clipId)) {
            seenClipIds.add(clipId);
            allClips.push(clip);
            if (clip.category) categoriesSet.set(clip.category.slug, clip.category.name);
          }
        }
      }
      console.log(`Fetched ${allClips.length} clips from viral streamers`);
    }
    
    // Fetch from general/category endpoints
    if (allClips.length < 500) {
      console.log('Fetching additional clips from general endpoint...');
      
      // If categories specified, fetch from each
      const categoriesToFetch = catList.length > 0 ? catList : [null];
      
      for (const cat of categoriesToFetch) {
        const pagesToFetch = cat ? 25 : 50;
        for (let page = 1; page <= pagesToFetch; page++) {
          try {
            const clipsUrl = cat 
              ? `https://kick.com/api/v2/categories/${cat}/clips?sort=${getSortParam(sortBy)}&time=${timeParams.kickTime}&page=${page}`
              : `https://kick.com/api/v2/clips?sort=${getSortParam(sortBy)}&time=${timeParams.kickTime}&page=${page}`;
            
            console.log(`Fetching page ${page}: ${clipsUrl}`);
            const clipsResponse = await fetch(clipsUrl, { headers: kickHeaders });
            
            if (clipsResponse.ok) {
              const clipsData = await clipsResponse.json();
              const clips = clipsData.clips || clipsData.data || [];
              console.log(`Page ${page}: ${clips.length} clips`);
              if (clips.length === 0) break;
              
              for (const clip of clips) {
                const clipId = clip.id || clip.clip_id;
                if (!seenClipIds.has(clipId) && isWithinTimeLimit(clip.created_at)) {
                  seenClipIds.add(clipId);
                  allClips.push(clip);
                  if (clip.category) categoriesSet.set(clip.category.slug, clip.category.name);
                }
              }
            } else {
              console.log(`Page ${page}: Response ${clipsResponse.status}`);
              break;
            }
          } catch (e) {
            console.error(`Error fetching page ${page}:`, e);
            break;
          }
        }
      }
    }
    
    console.log('Total clips fetched:', allClips.length);
    
    // Filter by categories if specified and clips came from general endpoint
    let filteredClips = allClips;
    if (catList.length > 0) {
      filteredClips = filteredClips.filter(clip => {
        const catSlug = clip.category?.slug;
        return catSlug && catList.includes(catSlug);
      });
    }
    
    // Sort
    filteredClips.sort((a, b) => {
      const viewsA = a.views || a.view_count || 0;
      const viewsB = b.views || b.view_count || 0;
      return viewsB - viewsA;
    });
    
    // Paginate
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + limit;
    const paginatedClips = filteredClips.slice(startIndex, endIndex);
    const nextCursor = endIndex < filteredClips.length ? endIndex.toString() : null;
    
    const formattedClips = paginatedClips.map((clip: any) => ({
      id: clip.id || clip.clip_id,
      title: clip.title || 'Sin título',
      broadcaster_name: clip.channel?.username || clip.creator?.username || clip.broadcaster_name || 'Unknown',
      game_name: clip.category?.name || clip.category_name || 'Unknown',
      thumbnail_url: clip.thumbnail_url || clip.thumbnail || '',
      view_count: clip.views || clip.view_count || 0,
      duration: clip.duration || 0,
      created_at: clip.created_at || new Date().toISOString(),
      url: clip.clip_url ? `https://kick.com/${clip.channel?.slug || 'clip'}?clip=${clip.id}` : `https://kick.com/clip/${clip.id}`,
      embed_url: clip.clip_url || clip.video_url || '',
      platform: 'kick',
    }));

    return new Response(
      JSON.stringify({
        success: true, clips: formattedClips,
        categories: Array.from(categoriesSet.entries()).map(([slug, name]) => ({ id: slug, name })),
        totalFound: filteredClips.length, nextCursor,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching Kick clips:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error', clips: [], categories: [], totalFound: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
