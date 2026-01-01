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
    const { categorySlug, sortBy = 'view', timeFilter = 'week', limit = 20, cursor } = await req.json().catch(() => ({}));
    
    console.log(`Fetching Kick clips - category: ${categorySlug}, sort: ${sortBy}, time: ${timeFilter}, limit: ${limit}, cursor: ${cursor}`);
    
    const allClips: any[] = [];
    const seenClipIds = new Set<string>();
    const categoriesSet = new Map<string, string>();
    
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
    
    // Fetch clips from the general clips endpoint (which works without auth)
    console.log('Fetching clips from general endpoint...');
    
    // Fetch multiple pages to get more clips
    const pagesToFetch = categorySlug ? 3 : 5;
    
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
              
              // Extract category info
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
    
    // If no clips from category endpoint, try the general clips endpoint
    if (allClips.length === 0) {
      console.log('Trying general clips endpoint...');
      try {
        const generalClipsUrl = `https://kick.com/api/v2/clips?sort=${getSortParam(sortBy)}&time=${getTimeParam(timeFilter)}&page=1`;
        
        const generalResponse = await fetch(generalClipsUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (generalResponse.ok) {
          const generalData = await generalResponse.json();
          const clips = generalData.clips || generalData.data || [];
          console.log('General endpoint clips:', clips.length);
          
          for (const clip of clips) {
            const clipId = clip.id || clip.clip_id;
            if (!seenClipIds.has(clipId)) {
              seenClipIds.add(clipId);
              allClips.push(clip);
            }
          }
        }
      } catch (e) {
        console.error('Error fetching general clips:', e);
      }
    }
    
    // If still no clips, try the private API endpoint
    if (allClips.length === 0) {
      console.log('Trying private API endpoint...');
      try {
        const privateClipsUrl = 'https://api.kick.com/private/v1/clips';
        
        const privateResponse = await fetch(privateClipsUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (privateResponse.ok) {
          const privateData = await privateResponse.json();
          const clips = privateData.clips || privateData.data || [];
          console.log('Private endpoint clips:', clips.length);
          
          for (const clip of clips) {
            const clipId = clip.id || clip.clip_id;
            if (!seenClipIds.has(clipId)) {
              seenClipIds.add(clipId);
              allClips.push(clip);
            }
          }
        } else {
          console.log('Private API response:', privateResponse.status);
        }
      } catch (e) {
        console.error('Error fetching private clips:', e);
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
        status: 200, // Return 200 to prevent frontend errors
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
