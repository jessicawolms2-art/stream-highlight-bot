import { useEffect, useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame, Eye, Clock, ExternalLink, Loader2, RefreshCw, Gamepad2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface KickClip {
  id: string;
  title: string;
  broadcaster_name: string;
  game_name: string;
  thumbnail_url: string;
  view_count: number;
  duration: number;
  created_at: string;
  url: string;
  embed_url: string;
  platform: string;
}

interface Category {
  id: string;
  name: string;
}

const TIME_FILTERS = [
  { code: 'day', name: 'Últimas 24h' },
  { code: 'week', name: 'Última semana' },
  { code: 'month', name: 'Último mes' },
  { code: 'all', name: 'Todo el tiempo' },
];

const SORT_OPTIONS = [
  { code: 'view', name: 'Más vistas' },
  { code: 'recent', name: 'Más recientes' },
];

const KickTrendingClips = () => {
  const [clips, setClips] = useState<KickClip[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categorySlug, setCategorySlug] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState('week');
  const [sortBy, setSortBy] = useState('view');
  const [totalFound, setTotalFound] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fetchKickClips = async (reset = true, cursorOverride?: string | null) => {
    if (reset) {
      setIsLoading(true);
      setClips([]);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);
    
    const cursorToUse = reset ? undefined : cursorOverride;
    
    try {
      const { data, error } = await supabase.functions.invoke('get-kick-clips', {
        body: { 
          categorySlug: categorySlug === 'all' ? undefined : categorySlug,
          sortBy,
          timeFilter,
          limit: 20,
          cursor: cursorToUse,
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      if (reset) {
        setClips(data.clips || []);
        setCategories(data.categories || []);
      } else {
        setClips(prev => [...prev, ...(data.clips || [])]);
      }
      
      setTotalFound(data.totalFound || 0);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error('Error fetching Kick clips:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar clips de Kick');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchKickClips(true);
  }, [categorySlug, timeFilter, sortBy]);

  const loadMore = useCallback(() => {
    if (nextCursor && !isLoadingMore && !isLoading) {
      fetchKickClips(false, nextCursor);
    }
  }, [nextCursor, isLoadingMore, isLoading, categorySlug, timeFilter, sortBy]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore]);

  const formatViewCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Hace menos de 1h';
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${Math.floor(diffHours / 24)}d`;
  };

  return (
    <Card className="p-6 bg-card border-border shadow-card">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-[#53fc18]" />
            <h3 className="text-lg font-semibold text-foreground">
              Clips Trending Kick
            </h3>
            {totalFound > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalFound} encontrados
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="text-xs bg-[#53fc18] text-black hover:bg-[#53fc18]/90">
              Kick
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => fetchKickClips(true)}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            <Select value={categorySlug} onValueChange={setCategorySlug}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                {TIME_FILTERS.map((filter) => (
                  <SelectItem key={filter.code} value={filter.code}>
                    {filter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading && clips.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#53fc18]" />
          <span className="ml-3 text-muted-foreground">Cargando clips de Kick...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={() => fetchKickClips(true)}>
            Reintentar
          </Button>
        </div>
      ) : clips.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flame className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No se encontraron clips de Kick con los filtros seleccionados</p>
          <p className="text-sm mt-2">Prueba con otros filtros o categoría</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clips.map((clip, index) => (
              <a
                key={clip.id}
                href={clip.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative rounded-lg overflow-hidden bg-secondary border border-border hover:border-[#53fc18] transition-all hover:scale-[1.02]"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video">
                  <img
                    src={clip.thumbnail_url || '/placeholder.svg'}
                    alt={clip.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                  {/* Rank badge */}
                  {index < 3 && (
                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-yellow-950' :
                      index === 1 ? 'bg-gray-300 text-gray-800' :
                      'bg-amber-600 text-amber-950'
                    }`}>
                      {index + 1}
                    </div>
                  )}
                  {/* Duration */}
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-background/80 text-xs font-medium">
                    {formatDuration(clip.duration)}
                  </div>
                  {/* Views overlay */}
                  <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-[#53fc18]/90 text-black text-xs font-medium flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {formatViewCount(clip.view_count)}
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-[#53fc18]/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ExternalLink className="h-8 w-8 text-white" />
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-3">
                  <h4 className="text-sm font-medium text-foreground line-clamp-2 mb-2 group-hover:text-[#53fc18] transition-colors">
                    {clip.title}
                  </h4>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate max-w-[60%]">{clip.broadcaster_name}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span className="truncate max-w-[60%]">{clip.game_name}</span>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{getTimeAgo(clip.created_at)}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
          
          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} className="mt-8 flex justify-center">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Cargando más clips...</span>
              </div>
            )}
            {!isLoadingMore && nextCursor && (
              <Button
                variant="outline"
                onClick={loadMore}
                className="border-[#53fc18]/50 hover:bg-[#53fc18]/10"
              >
                Cargar más clips
              </Button>
            )}
            {!nextCursor && clips.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Has visto todos los clips disponibles ({clips.length} de {totalFound})
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
};

export default KickTrendingClips;
