import { useEffect, useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Flame, Eye, Clock, ExternalLink, Loader2, RefreshCw, Gamepad2, Calendar, CheckCircle, X, Download, User, Globe, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import MultiSelectFilter, { FilterOption } from "@/components/MultiSelectFilter";
import FavoriteStreamersMenu from "@/components/FavoriteStreamersMenu";
import { useFavoriteStreamers } from "@/hooks/use-favorite-streamers";


const VIEWED_CLIPS_KEY = 'kick_viewed_clips';
const VIEWED_CLIPS_DATA_KEY = 'kick_viewed_clips_data';

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

interface KickChannel {
  id: string;
  slug: string;
  username: string;
  profile_pic: string;
  is_live: boolean;
  viewer_count: number;
  category: string;
}

const TIME_FILTERS = [
  { code: '1h', name: 'Última hora' },
  { code: '2h', name: 'Últimas 2h' },
  { code: '3h', name: 'Últimas 3h' },
  { code: '4h', name: 'Últimas 4h' },
  { code: '6h', name: 'Últimas 6h' },
  { code: '12h', name: 'Últimas 12h' },
  { code: 'day', name: 'Últimas 24h' },
  { code: '2days', name: 'Últimos 2 días' },
  { code: '3days', name: 'Últimos 3 días' },
  { code: 'week', name: 'Última semana' },
  { code: '2weeks', name: 'Últimas 2 semanas' },
  { code: 'month', name: 'Último mes' },
  { code: 'all', name: 'Todo el tiempo' },
];

const SORT_OPTIONS = [
  { code: 'view', name: 'Más vistas' },
  { code: 'recent', name: 'Más recientes' },
];

const KICK_LANGUAGES: FilterOption[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'all', label: 'Todos' },
];

interface StoredKickClip {
  id: string;
  title: string;
  broadcaster_name: string;
  game_name: string;
  thumbnail_url: string;
  view_count: number;
  duration: number;
  created_at: string;
  url: string;
}

const getViewedClips = (): Set<string> => {
  try {
    const stored = localStorage.getItem(VIEWED_CLIPS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
};

const getViewedClipsData = (): Map<string, StoredKickClip> => {
  try {
    const stored = localStorage.getItem(VIEWED_CLIPS_DATA_KEY);
    if (!stored) return new Map();
    return new Map(Object.entries(JSON.parse(stored)));
  } catch { return new Map(); }
};

const saveViewedClips = (viewed: Set<string>) => {
  localStorage.setItem(VIEWED_CLIPS_KEY, JSON.stringify([...viewed]));
};

const saveViewedClipData = (clip: StoredKickClip) => {
  const current = getViewedClipsData();
  current.set(clip.id, clip);
  localStorage.setItem(VIEWED_CLIPS_DATA_KEY, JSON.stringify(Object.fromEntries(current)));
};

const removeViewedClipData = (clipId: string) => {
  const current = getViewedClipsData();
  current.delete(clipId);
  localStorage.setItem(VIEWED_CLIPS_DATA_KEY, JSON.stringify(Object.fromEntries(current)));
};

const KickTrendingClips = () => {
  const { toast } = useToast();
  const [clips, setClips] = useState<KickClip[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['es']);
  const [timeFilter, setTimeFilter] = useState('week');
  const [sortBy, setSortBy] = useState('view');
  const [totalFound, setTotalFound] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [viewedClips, setViewedClips] = useState<Set<string>>(getViewedClips);
  const [hideViewed, setHideViewed] = useState(false);
  const [showOnlyViewed, setShowOnlyViewed] = useState(false);
  
  // Streamer filter
  const [selectedStreamers, setSelectedStreamers] = useState<{ name: string; avatar?: string }[]>([]);
  const [streamerInput, setStreamerInput] = useState('');
  const [channelSuggestions, setChannelSuggestions] = useState<KickChannel[]>([]);
  const [isSearchingChannels, setIsSearchingChannels] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const toggleViewedClip = (clip: KickClip, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newViewed = new Set(viewedClips);
    if (newViewed.has(clip.id)) {
      newViewed.delete(clip.id);
      removeViewedClipData(clip.id);
    } else {
      newViewed.add(clip.id);
      saveViewedClipData({
        id: clip.id, title: clip.title, broadcaster_name: clip.broadcaster_name,
        game_name: clip.game_name, thumbnail_url: clip.thumbnail_url, view_count: clip.view_count,
        duration: clip.duration, created_at: clip.created_at, url: clip.url,
      });
    }
    setViewedClips(newViewed);
    saveViewedClips(newViewed);
  };

  const handleDownloadClip = (clipUrl: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(clipUrl).then(() => {
      window.open('https://clipsey.com/', '_blank', 'noopener');
      toast({ title: "Enlace copiado", description: "El enlace del clip se copió al portapapeles. Pégalo en Clipsey." });
    }).catch(() => {
      window.open('https://clipsey.com/', '_blank', 'noopener');
      toast({ title: "Abriendo Clipsey", description: "Copia manualmente el enlace del clip en Clipsey." });
    });
  };

  const clearAllViewed = () => {
    setViewedClips(new Set());
    localStorage.removeItem(VIEWED_CLIPS_KEY);
    localStorage.removeItem(VIEWED_CLIPS_DATA_KEY);
  };

  const getDisplayClips = (): KickClip[] => {
    if (showOnlyViewed) {
      const storedData = getViewedClipsData();
      const byId = new Map<string, KickClip>();
      storedData.forEach((clip, id) => {
        if (viewedClips.has(id)) byId.set(id, { ...clip, embed_url: clip.url, platform: 'kick' } as KickClip);
      });
      clips.forEach(clip => {
        if (viewedClips.has(clip.id) && !byId.has(clip.id)) byId.set(clip.id, clip);
      });
      return Array.from(byId.values());
    }
    if (hideViewed) return clips.filter(clip => !viewedClips.has(clip.id));
    return clips;
  };


  const filteredClips = getDisplayClips();

  // Search Kick channels
  const searchChannels = useCallback(async (query: string) => {
    if (query.length < 2) { setChannelSuggestions([]); return; }
    setIsSearchingChannels(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-kick-clips', {
        body: { action: 'search_channels', query }
      });
      if (error) throw error;
      setChannelSuggestions(data.channels || []);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Error searching channels:', err);
      setChannelSuggestions([]);
    } finally {
      setIsSearchingChannels(false);
    }
  }, []);

  const handleStreamerInputChange = (value: string) => {
    setStreamerInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchChannels(value), 300);
  };

  const selectChannel = (channel: KickChannel) => {
    if (!selectedStreamers.find(s => s.name.toLowerCase() === channel.username.toLowerCase())) {
      setSelectedStreamers(prev => [...prev, { name: channel.slug || channel.username, avatar: channel.profile_pic }]);
    }
    setStreamerInput('');
    setShowSuggestions(false);
    setChannelSuggestions([]);
  };

  const removeStreamer = (name: string) => {
    setSelectedStreamers(prev => prev.filter(s => s.name !== name));
  };

  const handleStreamerKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && streamerInput.trim()) {
      if (!selectedStreamers.find(s => s.name.toLowerCase() === streamerInput.trim().toLowerCase())) {
        setSelectedStreamers(prev => [...prev, { name: streamerInput.trim() }]);
      }
      setStreamerInput('');
      setShowSuggestions(false);
    }
    if (e.key === 'Escape') setShowSuggestions(false);
  };

  const fetchKickClips = async (reset = true, cursorOverride?: string | null) => {
    if (reset) { setIsLoading(true); setClips([]); } else { setIsLoadingMore(true); }
    setError(null);
    const cursorToUse = reset ? undefined : cursorOverride;
    const streamerNames = selectedStreamers.map(s => s.name);
    
    try {
      const { data, error } = await supabase.functions.invoke('get-kick-clips', {
        body: { 
          categorySlugs: selectedCategories.length > 0 ? selectedCategories : undefined,
          sortBy,
          timeFilter,
          limit: 40,
          cursor: cursorToUse,
          languages: selectedLanguages.length > 0 ? selectedLanguages : ['es'],
          streamerNames: streamerNames.length > 0 ? streamerNames : undefined,
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
  }, [selectedCategories, timeFilter, sortBy, selectedLanguages, selectedStreamers]);

  const loadMore = useCallback(() => {
    if (nextCursor && !isLoadingMore && !isLoading) {
      fetchKickClips(false, nextCursor);
    }
  }, [nextCursor, isLoadingMore, isLoading, selectedCategories, timeFilter, sortBy, selectedLanguages, selectedStreamers]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [loadMore]);

  const categoryOptions: FilterOption[] = categories.map(c => ({ value: c.id, label: c.name }));

  const formatViewCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
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
            <h3 className="text-lg font-semibold text-foreground">Clips Trending Kick</h3>
            {totalFound > 0 && (
              <Badge variant="secondary" className="text-xs">{totalFound} encontrados</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="text-xs bg-[#53fc18] text-black hover:bg-[#53fc18]/90">Kick</Badge>
            <Button variant="ghost" size="icon" onClick={() => fetchKickClips(true)} disabled={isLoading} className="h-8 w-8">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Multi-select: Categories */}
          <MultiSelectFilter
            options={categoryOptions}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            placeholder="Todas las categorías"
            icon={<Gamepad2 className="h-4 w-4" />}
            searchable
            searchPlaceholder="Buscar categoría..."
          />

          {/* Multi-select: Languages */}
          <MultiSelectFilter
            options={KICK_LANGUAGES}
            selected={selectedLanguages}
            onChange={setSelectedLanguages}
            placeholder="Todos los idiomas"
            icon={<Globe className="h-4 w-4" />}
          />

          {/* Time filter */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Periodo" /></SelectTrigger>
              <SelectContent>
                {TIME_FILTERS.map((filter) => (
                  <SelectItem key={filter.code} value={filter.code}>{filter.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Ordenar" /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.code} value={option.code}>{option.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Streamer filter */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="relative">
              <Input
                placeholder="Añadir streamer..."
                value={streamerInput}
                onChange={(e) => handleStreamerInputChange(e.target.value)}
                onKeyDown={handleStreamerKeyPress}
                onFocus={() => {
                  if (streamerInput.length >= 2 && channelSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                className="w-[180px] h-9"
              />
              {isSearchingChannels && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {showSuggestions && channelSuggestions.length > 0 && (
                <div className="absolute top-full left-0 z-50 mt-1 w-[280px] rounded-md border bg-popover p-1 shadow-md">
                  <div className="max-h-[300px] overflow-y-auto">
                    {channelSuggestions.map((channel) => (
                      <button
                        key={channel.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectChannel(channel)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-accent rounded-md transition-colors text-left"
                      >
                        {channel.profile_pic && <img src={channel.profile_pic} alt="" className="w-8 h-8 rounded-full" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{channel.username}</span>
                            {channel.is_live && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">LIVE</Badge>
                            )}
                          </div>
                          {channel.category && (
                            <span className="text-xs text-muted-foreground truncate block">{channel.category}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2 border-l border-border pl-3">
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
              <Button
                variant={!hideViewed && !showOnlyViewed ? "default" : "ghost"}
                size="sm" onClick={() => { setHideViewed(false); setShowOnlyViewed(false); }}
                className="h-7 text-xs"
              >Todos</Button>
              <Button
                variant={hideViewed ? "default" : "ghost"}
                size="sm" onClick={() => { setHideViewed(true); setShowOnlyViewed(false); }}
                className="h-7 text-xs"
              ><Eye className="h-3 w-3 mr-1" /> Sin ver</Button>
              <Button
                variant={showOnlyViewed ? "default" : "ghost"}
                size="sm" onClick={() => { setShowOnlyViewed(true); setHideViewed(false); }}
                className="h-7 text-xs" disabled={viewedClips.size === 0}
              ><CheckCircle className="h-3 w-3 mr-1" /> Vistos ({viewedClips.size})</Button>
            </div>
            {viewedClips.size > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllViewed}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              ><X className="h-3 w-3 mr-1" /> Limpiar</Button>
            )}
          </div>
        </div>

        {/* Active streamer badges */}
        {selectedStreamers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Streamers:</span>
            {selectedStreamers.map((s) => (
              <Badge key={s.name} variant="secondary" className="text-xs flex items-center gap-1">
                {s.avatar && <img src={s.avatar} alt="" className="w-4 h-4 rounded-full" />}
                <span>{s.name}</span>
                <button onClick={() => removeStreamer(s.name)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setSelectedStreamers([])}
              className="h-6 text-xs text-muted-foreground hover:text-destructive px-1"
            >Limpiar</Button>
          </div>
        )}
      </div>

      {isLoading && clips.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#53fc18]" />
          <span className="ml-3 text-muted-foreground">Cargando clips de Kick...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={() => fetchKickClips(true)}>Reintentar</Button>
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
            {filteredClips.map((clip, index) => {
              const isViewed = viewedClips.has(clip.id);
              return (
                <div
                  key={clip.id}
                  className={`group relative rounded-lg overflow-hidden bg-secondary border transition-all hover:scale-[1.02] ${
                    isViewed ? 'border-muted opacity-60 hover:opacity-100' : 'border-border hover:border-[#53fc18]'
                  }`}
                >
                  <a href={clip.url} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="relative aspect-video">
                      <img src={clip.thumbnail_url || '/placeholder.svg'} alt={clip.title}
                        className="w-full h-full object-cover" loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                      />
                      {isViewed && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs font-medium flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Visto
                        </div>
                      )}
                      {index < 3 && !isViewed && (
                        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500 text-yellow-950' :
                          index === 1 ? 'bg-gray-300 text-gray-800' :
                          'bg-amber-600 text-amber-950'
                        }`}>{index + 1}</div>
                      )}
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-background/80 text-xs font-medium">
                        {formatDuration(clip.duration)}
                      </div>
                      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-[#53fc18]/90 text-black text-xs font-medium flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {formatViewCount(clip.view_count)}
                      </div>
                      <div className="absolute inset-0 bg-[#53fc18]/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <ExternalLink className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-medium text-foreground line-clamp-2 mb-2 group-hover:text-[#53fc18] transition-colors">{clip.title}</h4>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate max-w-[60%]">{clip.broadcaster_name}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                        <span className="truncate max-w-[60%]">{clip.game_name}</span>
                        <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>{getTimeAgo(clip.created_at)}</span></div>
                      </div>
                    </div>
                  </a>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={(e) => handleDownloadClip(clip.url, e)}
                      className="h-7 px-2 bg-background/90 hover:bg-background" title="Descargar clip"
                    ><Download className="h-3 w-3 mr-1" /> Descargar</Button>
                    <Button
                      variant={isViewed ? "secondary" : "ghost"} size="sm"
                      onClick={(e) => toggleViewedClip(clip, e)}
                      className="h-7 px-2 bg-background/90 hover:bg-background"
                    >
                      {isViewed ? (<><X className="h-3 w-3 mr-1" /> Quitar</>) : (<><CheckCircle className="h-3 w-3 mr-1" /> Visto</>)}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div ref={loadMoreRef} className="mt-8 flex justify-center">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /><span>Cargando más clips...</span>
              </div>
            )}
            {!isLoadingMore && nextCursor && (
              <Button variant="outline" onClick={loadMore} className="border-[#53fc18]/50 hover:bg-[#53fc18]/10">
                Cargar más clips
              </Button>
            )}
            {!nextCursor && clips.length > 0 && (
              <p className="text-sm text-muted-foreground">Has visto todos los clips disponibles ({clips.length} de {totalFound})</p>
            )}
          </div>
        </>
      )}
    </Card>
  );
};

export default KickTrendingClips;
