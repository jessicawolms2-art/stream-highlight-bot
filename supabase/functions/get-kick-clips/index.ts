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
    
    // Spanish streamer slugs to prioritize for Spanish content - mega expanded list
    const spanishStreamers = [
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
      'maurg1', 'memo_aponte', 'godyolo', 'espi', 'manucraft'
    ];
    
    // Map time filter to Kick's format
    const getTimeParam = (filter: string): string => {
      switch (filter) {
        case 'day': return 'day';
        case 'week': return 'week';
        case 'month': return 'month';
        case 'all': return 'all';
        default: return 'week';
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
    
    // For Spanish content, fetch from Spanish streamers directly
    if (language === 'es') {
      console.log('Fetching clips from Spanish streamers...');
      
      // Fetch clips from all Spanish streamers in parallel (up to 60)
      const streamerPromises = spanishStreamers.slice(0, 60).map(async (streamer) => {
        try {
          const clipsUrl = `https://kick.com/api/v2/channels/${streamer}/clips?sort=${getSortParam(sortBy)}&time=${getTimeParam(timeFilter)}`;
          console.log(`Fetching clips from ${streamer}`);
          
          const response = await fetch(clipsUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            return data.clips || [];
          }
          return [];
        } catch (e) {
          console.error(`Error fetching clips from ${streamer}:`, e);
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
      
      console.log(`Fetched ${allClips.length} clips from Spanish streamers`);
    }
    
    // Always also fetch from general endpoint for more variety
    if (allClips.length < 200) {
      console.log('Fetching additional clips from general endpoint...');
      
      const pagesToFetch = categorySlug ? 10 : 20; // Increased from 5/10 to 10/20
      
      for (let page = 1; page <= pagesToFetch; page++) {
        try {
          const clipsUrl = categorySlug 
            ? `https://kick.com/api/v2/categories/${categorySlug}/clips?sort=${getSortParam(sortBy)}&time=${getTimeParam(timeFilter)}&page=${page}`
            : `https://kick.com/api/v2/clips?sort=${getSortParam(sortBy)}&time=${getTimeParam(timeFilter)}&page=${page}`;
          
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
              if (!seenClipIds.has(clipId)) {
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
