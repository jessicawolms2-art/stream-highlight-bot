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
  category: {
    id: number;
    name: string;
    slug: string;
  };
  creator: {
    username: string;
  };
  channel: {
    username: string;
    slug: string;
  };
}

interface KickCategory {
  id: number;
  name: string;
  slug: string;
  banner?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, query, categorySlug, sortBy = 'view', timeFilter = 'week', limit = 20, cursor, language = 'es' } = body;
    
    // Handle channel search
    if (action === 'search_channels' && query) {
      console.log(`Searching Kick channels for: ${query}`);
      
      try {
        const searchUrl = `https://kick.com/api/v2/search?query=${encodeURIComponent(query)}`;
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const channels = (searchData.channels || []).map((ch: any) => ({
            id: ch.id,
            slug: ch.slug || ch.channel_slug,
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
        
        // Fallback: try direct channel lookup
        const directUrl = `https://kick.com/api/v2/channels/${query.toLowerCase()}`;
        const directResponse = await fetch(directUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (directResponse.ok) {
          const ch = await directResponse.json();
          const channels = [{
            id: ch.id,
            slug: ch.slug,
            username: ch.user?.username || ch.slug,
            profile_pic: ch.user?.profile_pic || '',
            is_live: ch.livestream !== null,
            viewer_count: ch.livestream?.viewer_count || 0,
            category: ch.livestream?.categories?.[0]?.name || '',
          }];
          
          return new Response(
            JSON.stringify({ success: true, channels }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: true, channels: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error('Error searching Kick channels:', err);
        return new Response(
          JSON.stringify({ success: false, channels: [], error: 'Search failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log(`Fetching Kick clips - category: ${categorySlug}, sort: ${sortBy}, time: ${timeFilter}, limit: ${limit}, cursor: ${cursor}, language: ${language}`);
    
    const allClips: any[] = [];
    const seenClipIds = new Set<string>();
    const categoriesSet = new Map<string, string>();
    
    // Viral/popular streamers list - includes both Spanish and international viral creators
    const viralStreamers = [
      // TOP VIRAL INTERNATIONAL STREAMERS
      'ishowspeed', 'kaicenat', 'xqc', 'adin', 'adinross', 'sketch', 'jynxzi',
      'caseoh', 'caseoh_', 'nickmercs', 'hasanabi', 'amouranth', 'pokimane',
      'tenz', 'shroud', 'ninja', 'tfue', 'faze_swagg', 'clix', 'ronaldo',
      'trainwreckstv', 'roshtein', 'stakef1red', 'corinnakopf', 'mizkif',
      'nmplol', 'sodapoppin', 'erobb221', 'emiru', 'fanfan', 'valkyrae',
      'disguisedtoast', 'sykkuno', 'fuslie', 'lilypichu', 'qtcinderella',
      'moistcr1tikal', 'ludwig', 'atrioc', 'clintstevens', 'yassuo',
      'lacy', 'plaqueboymax', 'duke_dennis', 'agent00', 'yourragegaming',
      'ricegum', 'faze_banks', 'faze_temperrr', 'faze_rug', 'sssniperwolf',
      'ksi', 'miniminter', 'sidemen', 'tommyinnit', 'tubbo', 'ranboo',
      'georgenotfound', 'sapnap', 'karl', 'quackitytoo', 'foolish_gamers',
      'ludwig', 'hasanabi', 'destiny', 'asmongold', 'nmplol',
      'ironmouse', 'nyanners', 'veibae', 'zentreya', 'projekt_melody',
      'stable_ronaldo', 'stable_ronaldo_', 'cloakzy', 'symfuhny',
      
      // Top Spanish streamers
      'auronplay', 'ibai', 'elxokas', 'illojuan', 'rubius', 'thegrefg', 
      'juansguarnizo', 'rivers_gg', 'westcol', 'arigameplays', 'elmariana',
      'fernanfloo', 'ded', 'roier', 'karmaland', 'quackity', 'vegetta777',
      'alexby11', 'willyrex', 'ampeterby7', 'elded', 'gerardromero', 
      'davidguapo', 'jordiwild', 'llados', 'cheeto', 'zeling', 'werlyb',
      'knekro', 'reborn', 'mayichi', 'jaggerprincesa', 'carola', 'cristinini',
      'silithur', 'byviruzz', 'paracetamor', 'zorman', 'mrgranbomba',
      'elmillor', 'spreen', 'coscu', 'momo', 'frankkaster',
      // Additional popular Spanish streamers
      'biyin', 'etoiles', 'orslok', 'perxitaa', 'elspsjordi', 'djmariio',
      'ibelky', 'elvisitoo', 'alva', 'xfarganx', 'shadoune666', 'kenai',
      'kidd', 'luzugames', 'staxx', 'elogamer', 'nanomor', 'windygirk',
      'borjaval', 'papagenu', 'axozer', 'montanito', 'elrubius', 'agustabell212',
      'zord', 'nerea', 'staryuuki', 'lilithdrake', 'casjua', 'littleragergirl',
      // More Spanish/LATAM streamers
      'rakon', 'fargan', 'bymonkeyes', 'bystaxx', 'reventxz', 'wismichu',
      'rockerbob', 'lolito', 'polispol', 'outconsumer', 'grefusa', 'vicens',
      'folagor', 'th3antonio', 'mangelrogel', 'agar', 'nekojitablog', 'rickyedit',
      'thelastfeedback', 'zeballos', 'duxo', 'yeyo', 'minijuegosadri', 'lady',
      'ander', 'ssjoseph', 'arumisf', 'mrnabo', 'davidr', 'bebe',
      'papi_gavi', 'luzu', 'town', 'karchez', 'danirep', 'rubiuh',
      'ansjoa', 'zarcort', 'kronno', 'dosser', 'alkapone', 'thefatrat',
      // Argentina/Chile/Colombia streamers
      'coscu', 'duki', 'cosculindo', 'argenpe', 'tomii11', 'yao_cabrera',
      'robleis', 'demente', 'juegagerman', 'fercho', 'chilenito',
      'tiparraco', 'josecortes', 'alexis8a', 'markitooo', 'lacasitahp',
      // Mexico streamers
      'werevertumorro', 'luisitocomunica', 'juegermanplays', 'elmariana',
      'dross', 'aczino', 'deigamer', 'thedonato', 'yosoyplex',
      'maurg1', 'memo_aponte', 'godyolo', 'espi', 'manucraft',
      
      // MORE VIRAL/TRENDING CREATORS
      'sneako', 'fresh', 'freshandfit', 'myron', 'andrew_tate', 'tristan_tate',
      'itshafu', 'reckful', 'cdew', 'savix', 'swifty', 'hotted',
      'method_sco', 'jokerd', 'alinity', 'stpeach', 'kaceytron',
      'imane', 'lily', 'jenna', 'andrea_botez', 'alex_botez', 'gothamchess',
      'levy_rozman', 'hikaru', 'magnuscarlsen', 'chessbrahs', 'danya',
      'piratesoftware', 'theprimeagen', 'tsoding', 'jonhgalt',
      'timthetatman', 'drdisrespect', 'summit1g', 'lirik', 'cohhcarnage',
      'moonmoon', 'forsen', 'nymn', 'lacari', 'esfand', 'tectone'
    ];
    
    // Map time filter to Kick's format and get hours for filtering
    const getTimeParam = (filter: string): { kickTime: string; hoursLimit: number } => {
      switch (filter) {
        case '1h': return { kickTime: 'day', hoursLimit: 1 };
        case '2h': return { kickTime: 'day', hoursLimit: 2 };
        case '3h': return { kickTime: 'day', hoursLimit: 3 };
        case '4h': return { kickTime: 'day', hoursLimit: 4 };
        case '6h': return { kickTime: 'day', hoursLimit: 6 };
        case '12h': return { kickTime: 'day', hoursLimit: 12 };
        case 'day': return { kickTime: 'day', hoursLimit: 24 };
        case '2days': return { kickTime: 'week', hoursLimit: 48 };
        case '3days': return { kickTime: 'week', hoursLimit: 72 };
        case 'week': return { kickTime: 'week', hoursLimit: 168 };
        case '2weeks': return { kickTime: 'month', hoursLimit: 336 };
        case 'month': return { kickTime: 'month', hoursLimit: 720 }; // ~30 days
        case 'all': return { kickTime: 'all', hoursLimit: 999999 }; // Practically unlimited
        default: return { kickTime: 'week', hoursLimit: 168 };
      }
    };
    
    const timeParams = getTimeParam(timeFilter);
    console.log(`Time filter: ${timeFilter} -> Kick API: ${timeParams.kickTime}, Max hours: ${timeParams.hoursLimit}`);
    
    // Helper to check if clip is within time limit
    const isWithinTimeLimit = (createdAt: string): boolean => {
      if (!createdAt) return false;
      try {
        const clipDate = new Date(createdAt);
        if (isNaN(clipDate.getTime())) return false;
        
        const now = new Date();
        const diffHours = (now.getTime() - clipDate.getTime()) / (1000 * 60 * 60);
        const isValid = diffHours >= 0 && diffHours <= timeParams.hoursLimit;
        
        return isValid;
      } catch {
        return false;
      }
    };
    
    // Map sort to Kick's format  
    const getSortParam = (sort: string): string => {
      switch (sort) {
        case 'view': return 'view';
        case 'recent': return 'date';
        default: return 'view';
      }
    };
    
    // For Spanish content, fetch from viral streamers directly
    if (language === 'es') {
      console.log('Fetching clips from viral streamers...');
      
      // Fetch clips from all viral streamers in parallel (up to 150)
      const streamerPromises = viralStreamers.slice(0, 150).map(async (streamer: string) => {
        try {
          const clipsUrl = `https://kick.com/api/v2/channels/${streamer}/clips?sort=${getSortParam(sortBy)}&time=${timeParams.kickTime}`;
          
          const response = await fetch(clipsUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            // Filter clips by time limit
            const clips = (data.clips || []).filter((clip: any) => 
              isWithinTimeLimit(clip.created_at)
            );
            return clips;
          }
          return [];
        } catch (e) {
          return [];
        }
      });
      
      const results = await Promise.all(streamerPromises);
      
      for (const clips of results) {
        for (const clip of clips) {
          const clipId = clip.id || clip.clip_id;
          if (!seenClipIds.has(clipId)) {
            seenClipIds.add(clipId);
            allClips.push(clip);
            
            if (clip.category) {
              categoriesSet.set(clip.category.slug, clip.category.name);
            }
          }
        }
      }
      
      console.log(`Fetched ${allClips.length} clips from viral streamers`);
    }
    
    // Always also fetch from general endpoint for more variety
    if (allClips.length < 500) {
      console.log('Fetching additional clips from general endpoint...');
      
      const pagesToFetch = categorySlug ? 25 : 50; // Increased for more clips
      
      for (let page = 1; page <= pagesToFetch; page++) {
        try {
          const clipsUrl = categorySlug 
            ? `https://kick.com/api/v2/categories/${categorySlug}/clips?sort=${getSortParam(sortBy)}&time=${timeParams.kickTime}&page=${page}`
            : `https://kick.com/api/v2/clips?sort=${getSortParam(sortBy)}&time=${timeParams.kickTime}&page=${page}`;
          
          console.log(`Fetching page ${page}: ${clipsUrl}`);
          
          const clipsResponse = await fetch(clipsUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          
          if (clipsResponse.ok) {
            const clipsData = await clipsResponse.json();
            const clips = clipsData.clips || clipsData.data || [];
            
            console.log(`Page ${page}: ${clips.length} clips`);
            
            if (clips.length === 0) break;
            
            for (const clip of clips) {
              const clipId = clip.id || clip.clip_id;
              // Apply time filter
              if (!seenClipIds.has(clipId) && isWithinTimeLimit(clip.created_at)) {
                seenClipIds.add(clipId);
                allClips.push(clip);
                
                if (clip.category) {
                  categoriesSet.set(clip.category.slug, clip.category.name);
                }
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
    
    console.log('Total clips fetched:', allClips.length);
    
    // Sort clips by view count
    allClips.sort((a, b) => {
      const viewsA = a.views || a.view_count || 0;
      const viewsB = b.views || b.view_count || 0;
      return viewsB - viewsA;
    });
    
    // Paginate
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + limit;
    const paginatedClips = allClips.slice(startIndex, endIndex);
    const nextCursor = endIndex < allClips.length ? endIndex.toString() : null;
    
    // Format clips for the frontend
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
        success: true,
        clips: formattedClips,
        categories: Array.from(categoriesSet.entries()).map(([slug, name]) => ({ id: slug, name })),
        totalFound: allClips.length,
        nextCursor,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching Kick clips:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        clips: [],
        categories: [],
        totalFound: 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
