import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const kickHeaders = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Language-specific streamer lists
const spanishStreamers = [
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
  'robleis', 'demente', 'juegagerman',
  'werevertumorro', 'luisitocomunica', 'dross', 'thedonato',
  'clavicular', 'thenexxx', 'rivers',
];

const englishStreamers = [
  'ishowspeed', 'kaicenat', 'xqc', 'adin', 'adinross', 'sketch', 'jynxzi',
  'caseoh', 'caseoh_', 'nickmercs', 'hasanabi', 'amouranth', 'pokimane',
  'tenz', 'shroud', 'ninja', 'tfue', 'faze_swagg', 'clix', 'ronaldo',
  'trainwreckstv', 'roshtein', 'stakef1red', 'corinnakopf', 'mizkif',
  'nmplol', 'sodapoppin', 'erobb221', 'emiru', 'fanfan', 'valkyrae',
  'disguisedtoast', 'sykkuno', 'fuslie', 'lilypichu', 'qtcinderella',
  'moistcr1tikal', 'ludwig', 'atrioc', 'clintstevens', 'yassuo',
  'lacy', 'plaqueboymax', 'duke_dennis', 'agent00', 'yourragegaming',
  'sneako', 'piratesoftware', 'theprimeagen',
  'timthetatman', 'summit1g', 'lirik', 'cohhcarnage',
  'moonmoon', 'forsen', 'nymn', 'esfand', 'tectone',
  'rampagejackson', 'destiny', 'asmongold', 'cdotblam',
];

const portugueseStreamers = [
  'casimito', 'gaules', 'loud_coringa', 'baiano', 'yoda', 'cellbit',
  'felps', 'liminha', 'msjp', 'pfrancob', 'meduska',
];

const frenchStreamers = [
  'squeezie', 'domingo', 'gotaga', 'mickalow', 'blitzstream',
  'joueur_du_grenier', 'antoinedaniell', 'zerator',
];

const streamersByLang: Record<string, string[]> = {
  es: spanishStreamers,
  en: englishStreamers,
  pt: portugueseStreamers,
  fr: frenchStreamers,
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
      limit = 40, cursor,
      language, languages,
      streamerNames,
    } = body;

    const catList: string[] = categorySlugs || (categorySlug && categorySlug !== 'all' ? [categorySlug] : []);
    const langList: string[] = languages && languages.length > 0
      ? languages
      : (language ? [language] : ['es']);
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
          return new Response(JSON.stringify({ success: true, channels }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const directUrl = `https://kick.com/api/v2/channels/${query.toLowerCase()}`;
        const directResponse = await fetch(directUrl, { headers: kickHeaders });
        if (directResponse.ok) {
          const ch = await directResponse.json();
          return new Response(JSON.stringify({
            success: true, channels: [{
              id: ch.id, slug: ch.slug, username: ch.user?.username || ch.slug,
              profile_pic: ch.user?.profile_pic || '', is_live: ch.livestream !== null,
              viewer_count: ch.livestream?.viewer_count || 0,
              category: ch.livestream?.categories?.[0]?.name || '',
            }],
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ success: true, channels: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ success: false, channels: [], error: 'Search failed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const needsAllLangs = langList.includes('all') || langList.length === 0;

    console.log(`Fetching Kick clips - categories: ${catList}, sort: ${sortBy}, time: ${timeFilter}, languages: ${langList}, streamers: ${streamerList}`);

    const allClips: any[] = [];
    const seenClipIds = new Set<string>();
    const categoriesSet = new Map<string, string>();

    const startTime = Date.now();
    const TIME_BUDGET_MS = 25000;
    const BATCH_SIZE = 20;

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
    const getSortParam = (sort: string): string => sort === 'recent' ? 'date' : 'view';

    const isWithinTimeLimit = (createdAt: string): boolean => {
      if (!createdAt) return false;
      try {
        const clipDate = new Date(createdAt);
        if (isNaN(clipDate.getTime())) return false;
        const diffHours = (Date.now() - clipDate.getTime()) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= timeParams.hoursLimit;
      } catch { return false; }
    };

    const addClip = (clip: any) => {
      const clipId = clip.id || clip.clip_id;
      if (clipId && !seenClipIds.has(String(clipId))) {
        seenClipIds.add(String(clipId));
        allClips.push(clip);
        if (clip.category) categoriesSet.set(clip.category.slug, clip.category.name);
      }
    };

    const fetchStreamerClips = async (streamer: string): Promise<any[]> => {
      try {
        const url = `https://kick.com/api/v2/channels/${streamer}/clips?sort=${getSortParam(sortBy)}&time=${timeParams.kickTime}`;
        const resp = await fetch(url, { headers: kickHeaders });
        if (resp.ok) {
          const data = await resp.json();
          return (data.clips || []).filter((c: any) => isWithinTimeLimit(c.created_at));
        }
      } catch {}
      return [];
    };

    const fetchCategoryClips = async (cat: string, maxPages: number): Promise<any[]> => {
      const clips: any[] = [];
      for (let page = 1; page <= maxPages; page++) {
        if (Date.now() - startTime > TIME_BUDGET_MS) break;
        try {
          const url = `https://kick.com/api/v2/categories/${cat}/clips?sort=${getSortParam(sortBy)}&time=${timeParams.kickTime}&page=${page}`;
          const resp = await fetch(url, { headers: kickHeaders });
          if (!resp.ok) break;
          const data = await resp.json();
          const pageClips = data.clips || data.data || [];
          if (pageClips.length === 0) break;
          for (const c of pageClips) {
            if (isWithinTimeLimit(c.created_at)) clips.push(c);
          }
        } catch { break; }
      }
      return clips;
    };

    // CASE 1: Specific streamers requested
    if (streamerList.length > 0) {
      console.log(`Fetching clips from ${streamerList.length} specific streamers`);
      for (let i = 0; i < streamerList.length; i += BATCH_SIZE) {
        if (Date.now() - startTime > TIME_BUDGET_MS) break;
        const batch = streamerList.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(fetchStreamerClips));
        for (const clips of results) clips.forEach(addClip);
      }
      console.log(`Specific streamer clips: ${allClips.length}`);
    }

    // CASE 2: Category filter (with or without language) - fetch from category endpoint
    if (catList.length > 0) {
      console.log(`Fetching clips from ${catList.length} categories`);
      for (const cat of catList) {
        if (Date.now() - startTime > TIME_BUDGET_MS) break;
        const clips = await fetchCategoryClips(cat, 30);
        clips.forEach(addClip);
      }
      console.log(`Category clips: ${allClips.length}`);
    }

    // CASE 3: No specific streamers AND no categories → fetch from language streamers + general
    if (streamerList.length === 0 && catList.length === 0) {
      // Build streamer pool from selected languages
      const streamersToFetch: string[] = [];
      if (needsAllLangs) {
        for (const list of Object.values(streamersByLang)) streamersToFetch.push(...list);
      } else {
        for (const lang of langList) {
          const list = streamersByLang[lang];
          if (list) streamersToFetch.push(...list);
        }
      }
      const uniqueStreamers = [...new Set(streamersToFetch)];

      if (uniqueStreamers.length > 0) {
        console.log(`Fetching clips from ${uniqueStreamers.length} language-based streamers`);
        for (let i = 0; i < uniqueStreamers.length; i += BATCH_SIZE) {
          if (Date.now() - startTime > TIME_BUDGET_MS) break;
          const batch = uniqueStreamers.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(batch.map(fetchStreamerClips));
          for (const clips of results) clips.forEach(addClip);
        }
        console.log(`Streamer clips: ${allClips.length}`);
      }

      // Fill from general endpoint if still low
      if (allClips.length < 200) {
        console.log('Fetching additional clips from general endpoint...');
        for (let page = 1; page <= 30; page++) {
          if (Date.now() - startTime > TIME_BUDGET_MS) break;
          try {
            const url = `https://kick.com/api/v2/clips?sort=${getSortParam(sortBy)}&time=${timeParams.kickTime}&page=${page}`;
            const resp = await fetch(url, { headers: kickHeaders });
            if (!resp.ok) break;
            const data = await resp.json();
            const pageClips = data.clips || data.data || [];
            if (pageClips.length === 0) break;
            for (const c of pageClips) {
              if (isWithinTimeLimit(c.created_at)) addClip(c);
            }
          } catch { break; }
        }
        console.log(`After general: ${allClips.length}`);
      }
    }

    console.log(`Total clips collected: ${allClips.length}, time: ${Date.now() - startTime}ms`);

    // Apply filters
    let filteredClips = allClips;

    // Filter by category if streamers were fetched but category was also selected
    if (catList.length > 0 && streamerList.length > 0) {
      filteredClips = filteredClips.filter(clip => {
        const catSlug = clip.category?.slug;
        return catSlug && catList.some(c => catSlug === c || catSlug.includes(c) || c.includes(catSlug));
      });
    }

    // Filter by language when using streamer clips with no streamer filter
    // (language streamers already give language, but general endpoint needs filtering)
    // For category clips: try to filter by channel language if possible
    // We use the streamer slug to match against known language lists
    if (!needsAllLangs && catList.length > 0 && streamerList.length === 0) {
      // Build set of streamers per language for fast lookup
      const allowedStreamers = new Set<string>();
      for (const lang of langList) {
        const list = streamersByLang[lang];
        if (list) list.forEach(s => allowedStreamers.add(s.toLowerCase()));
      }
      // Only filter if we have known streamers for the selected languages
      if (allowedStreamers.size > 0) {
        const beforeCount = filteredClips.length;
        const langFiltered = filteredClips.filter(clip => {
          const channelSlug = (clip.channel?.slug || clip.channel?.username || '').toLowerCase();
          return allowedStreamers.has(channelSlug);
        });
        // Only apply language filter from categories if it doesn't remove everything
        if (langFiltered.length > 0) {
          filteredClips = langFiltered;
        }
        console.log(`Language filter on category clips: ${beforeCount} -> ${filteredClips.length}`);
      }
    }

    // Sort
    if (sortBy === 'recent') {
      filteredClips.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      filteredClips.sort((a, b) => (b.views || b.view_count || 0) - (a.views || a.view_count || 0));
    }

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
      url: `https://kick.com/${clip.channel?.slug || clip.channel?.username || 'clip'}?clip=${clip.id || clip.clip_id}`,
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
