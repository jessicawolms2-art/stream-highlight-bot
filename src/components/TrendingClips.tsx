import { useEffect, useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Flame, Eye, Clock, ExternalLink, Loader2, RefreshCw, Globe, Gamepad2, Timer, User, X, EyeOff, Check, Radio, Download, ArrowDownUp, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import MultiSelectFilter, { FilterOption } from "@/components/MultiSelectFilter";
import FavoriteStreamersMenu from "@/components/FavoriteStreamersMenu";
import { useFavoriteStreamers } from "@/hooks/use-favorite-streamers";


interface TrendingClip {
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
  language?: string;
}

interface Game {
  id: string;
  name: string;
}

interface TwitchChannel {
  id: string;
  broadcaster_login: string;
  display_name: string;
  thumbnail_url: string;
  is_live: boolean;
  game_name: string;
}

const LANGUAGES: FilterOption[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'ru', label: 'Русский' },
  { value: 'ko', label: '한국어' },
  { value: 'ja', label: '日本語' },
];

const TIME_FILTERS = [
  { value: '1h', label: '1 hora', hours: 1 },
  { value: '2h', label: '2 horas', hours: 2 },
  { value: '3h', label: '3 horas', hours: 3 },
  { value: '6h', label: '6 horas', hours: 6 },
  { value: '12h', label: '12 horas', hours: 12 },
  { value: '24h', label: '24 horas', hours: 24 },
  { value: '2d', label: '2 días', hours: 48 },
  { value: '3d', label: '3 días', hours: 72 },
  { value: '7d', label: '1 semana', hours: 168 },
  { value: '2w', label: '2 semanas', hours: 336 },
  { value: '3w', label: '3 semanas', hours: 504 },
  { value: '30d', label: '1 mes', hours: 720 },
];

const VIEWED_CLIPS_KEY = 'twitch_viewed_clips';
const VIEWED_CLIPS_DATA_KEY = 'twitch_viewed_clips_data';

interface StoredClip {
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
}

const getViewedClips = (): Set<string> => {
  try {
    const stored = localStorage.getItem(VIEWED_CLIPS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

const getViewedClipsData = (): Map<string, StoredClip> => {
  try {
    const stored = localStorage.getItem(VIEWED_CLIPS_DATA_KEY);
    if (!stored) return new Map();
    const parsed = JSON.parse(stored);
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
};

const saveViewedClips = (clips: Set<string>) => {
  localStorage.setItem(VIEWED_CLIPS_KEY, JSON.stringify([...clips]));
};

const saveViewedClipData = (clip: StoredClip) => {
  const current = getViewedClipsData();
  current.set(clip.id, clip);
  localStorage.setItem(VIEWED_CLIPS_DATA_KEY, JSON.stringify(Object.fromEntries(current)));
};

const removeViewedClipData = (clipId: string) => {
  const current = getViewedClipsData();
  current.delete(clipId);
  localStorage.setItem(VIEWED_CLIPS_DATA_KEY, JSON.stringify(Object.fromEntries(current)));
};

const TrendingClips = () => {
  const { toast } = useToast();
  const [clips, setClips] = useState<TrendingClip[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['es']);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState('7d');
  const [sortBy, setSortBy] = useState<'views' | 'recent'>('views');
  const [selectedStreamers, setSelectedStreamers] = useState<{ name: string; avatar?: string }[]>([]);
  const [streamerInput, setStreamerInput] = useState('');
  const [channelSuggestions, setChannelSuggestions] = useState<TwitchChannel[]>([]);
  const [isSearchingChannels, setIsSearchingChannels] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [totalFound, setTotalFound] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [viewedClips, setViewedClips] = useState<Set<string>>(getViewedClips);
  const [viewedClipsData, setViewedClipsData] = useState<Map<string, StoredClip>>(getViewedClipsData);
  const [isLoadingViewed, setIsLoadingViewed] = useState(false);
  const [hideViewed, setHideViewed] = useState(false);
  const [showOnlyViewed, setShowOnlyViewed] = useState(false);
  const { favorites, isFavorite, toggleFavorite, removeFavorite, clearFavorites } = useFavoriteStreamers('twitch');

  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Backfill stored metadata for clips marked as viewed before metadata was saved
  useEffect(() => {
    if (clips.length === 0 || viewedClips.size === 0) return;
    const stored = new Map(viewedClipsData);
    let changed = false;
    clips.forEach(clip => {
      if (viewedClips.has(clip.id) && !stored.has(clip.id)) {
        const storedClip = {
          id: clip.id, title: clip.title, broadcaster_name: clip.broadcaster_name,
          game_name: clip.game_name, thumbnail_url: clip.thumbnail_url, view_count: clip.view_count,
          duration: clip.duration, created_at: clip.created_at, url: clip.url, embed_url: clip.embed_url,
        };
        stored.set(clip.id, storedClip);
        saveViewedClipData(storedClip);
        changed = true;
      }
    });
    if (changed) setViewedClipsData(stored);
  }, [clips, viewedClips, viewedClipsData]);

  // Older viewed history only stored IDs. Recover all available metadata from
  // Twitch so the Viewed tab is not limited to clips in the current page.
  useEffect(() => {
    if (!showOnlyViewed || viewedClips.size === 0) return;
    const missingIds = [...viewedClips].filter(id => !viewedClipsData.has(id));
    if (missingIds.length === 0) return;

    let cancelled = false;
    const recoverViewedClips = async () => {
      setIsLoadingViewed(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-top-clips', {
          body: { action: 'get_clips_by_ids', clipIds: missingIds },
        });
        if (error) throw error;
        if (cancelled) return;
        const recovered = new Map(viewedClipsData);
        for (const clip of data?.clips || []) {
          recovered.set(clip.id, clip);
          saveViewedClipData(clip);
        }
        setViewedClipsData(recovered);
      } catch (err) {
        console.error('Error recovering viewed clips:', err);
      } finally {
        if (!cancelled) setIsLoadingViewed(false);
      }
    };
    recoverViewedClips();
    return () => { cancelled = true; };
  }, [showOnlyViewed, viewedClips, viewedClipsData]);



  const handleDownloadClip = (clip: TrendingClip, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(clip.url).then(() => {
      window.open('https://clipsey.com/', '_blank', 'noopener');
      toast({
        title: "Enlace copiado",
        description: "El enlace del clip se copió al portapapeles. Pégalo en Clipsey.",
      });
    }).catch(() => {
      window.open('https://clipsey.com/', '_blank', 'noopener');
      toast({
        title: "Abriendo Clipsey",
        description: "Copia manualmente el enlace del clip en Clipsey.",
      });
    });
  };

  const fetchTrendingClips = async (reset = true, cursorOverride?: string | null) => {
    if (reset) {
      setIsLoading(true);
      setClips([]);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);
    
    const cursorToUse = reset ? undefined : cursorOverride;
    const streamerNames = selectedStreamers.map(s => s.name);
    
    try {
      const { data, error } = await supabase.functions.invoke('get-top-clips', {
        body: { 
          languages: selectedLanguages.length > 0 ? selectedLanguages : [],
          limit: 40,
          cursor: cursorToUse,
          gameIds: selectedGameIds.length > 0 ? selectedGameIds : undefined,
          timeFilter,
          broadcasterNames: streamerNames.length > 0 ? streamerNames : undefined,
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      if (reset) {
        setClips(data.clips || []);
        setGames(data.games || []);
      } else {
        setClips(prev => [...prev, ...(data.clips || [])]);
      }
      
      setTotalFound(data.totalFound || 0);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error('Error fetching trending clips:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar clips');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTrendingClips(true);
  }, [selectedLanguages, selectedGameIds, timeFilter, selectedStreamers]);

  const loadMore = useCallback(() => {
    if (nextCursor && !isLoadingMore && !isLoading) {
      fetchTrendingClips(false, nextCursor);
    }
  }, [nextCursor, isLoadingMore, isLoading, selectedLanguages, selectedGameIds, timeFilter, selectedStreamers]);

  // Search channels for autocomplete
  const searchChannels = useCallback(async (query: string) => {
    if (query.length < 2) {
      setChannelSuggestions([]);
      return;
    }
    
    setIsSearchingChannels(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-top-clips', {
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

  const selectChannel = (channel: TwitchChannel) => {
    if (!selectedStreamers.find(s => s.name.toLowerCase() === channel.display_name.toLowerCase())) {
      setSelectedStreamers(prev => [...prev, { name: channel.display_name, avatar: channel.thumbnail_url }]);
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
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const toggleViewedClip = (clip: TrendingClip, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewedClips(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clip.id)) {
        newSet.delete(clip.id);
        removeViewedClipData(clip.id);
        setViewedClipsData(current => {
          const next = new Map(current);
          next.delete(clip.id);
          return next;
        });
      } else {
        newSet.add(clip.id);
        const storedClip = {
          id: clip.id, title: clip.title, broadcaster_name: clip.broadcaster_name,
          game_name: clip.game_name, thumbnail_url: clip.thumbnail_url, view_count: clip.view_count,
          duration: clip.duration, created_at: clip.created_at, url: clip.url, embed_url: clip.embed_url,
        };
        saveViewedClipData(storedClip);
        setViewedClipsData(current => new Map(current).set(clip.id, storedClip));
      }
      saveViewedClips(newSet);
      return newSet;
    });
  };

  const clearAllViewed = () => {
    setViewedClips(new Set());
    localStorage.removeItem(VIEWED_CLIPS_KEY);
    localStorage.removeItem(VIEWED_CLIPS_DATA_KEY);
    setViewedClipsData(new Map());
  };

  const getDisplayClips = (): TrendingClip[] => {
    let result: TrendingClip[];
    if (showOnlyViewed) {
      const byId = new Map<string, TrendingClip>();
      // Stored metadata (clips marked as viewed in any previous session)
      viewedClipsData.forEach((clip, id) => {
        if (viewedClips.has(id)) byId.set(id, { ...clip, language: undefined });
      });
      // Fallback: viewed ids without stored metadata but present in current results
      clips.forEach(clip => {
        if (viewedClips.has(clip.id) && !byId.has(clip.id)) byId.set(clip.id, clip);
      });
      result = Array.from(byId.values());
      if (selectedStreamers.length > 0) {
        const selectedNames = new Set(selectedStreamers.map(streamer => streamer.name.trim().toLowerCase()));
        result = result.filter(clip => selectedNames.has(clip.broadcaster_name.trim().toLowerCase()));
      }
      // In "viewed" mode never filter by view_count, just sort
      if (sortBy === 'recent') {
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } else {
        result.sort((a, b) => b.view_count - a.view_count);
      }
      return result;
    } else if (hideViewed) {
      result = clips.filter(clip => !viewedClips.has(clip.id));
    } else {
      result = [...clips];
    }

    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      // Filter out clips with unprocessed views (view_count <= 1) when sorting by views
      const hasRealViews = result.some(c => c.view_count > 1);
      if (hasRealViews) {
        result = result.filter(c => c.view_count > 1);
      }
      result.sort((a, b) => b.view_count - a.view_count);
    }

    return result;
  };


  const filteredClips = getDisplayClips();

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [loadMore]);

  const gameOptions: FilterOption[] = games.map(g => ({ value: g.id, label: g.name }));

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
            <Flame className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">
              Clips Trending ({TIME_FILTERS.find(t => t.value === timeFilter)?.label || '24h'})
            </h3>
            {totalFound > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalFound} encontrados
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Twitch</Badge>
            <Button 
              variant="ghost" size="icon" 
              onClick={() => fetchTrendingClips(true)}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Multi-select: Categories */}
          <MultiSelectFilter
            options={gameOptions}
            selected={selectedGameIds}
            onChange={setSelectedGameIds}
            placeholder="Todas las categorías"
            icon={<Gamepad2 className="h-4 w-4" />}
            searchable
            searchPlaceholder="Buscar categoría..."
          />

          {/* Multi-select: Languages */}
          <MultiSelectFilter
            options={LANGUAGES}
            selected={selectedLanguages}
            onChange={setSelectedLanguages}
            placeholder="Todos los idiomas"
            icon={<Globe className="h-4 w-4" />}
          />

          {/* Sort filter */}
          <div className="flex items-center gap-2">
            <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'views' | 'recent')}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="views">Más vistas</SelectItem>
                <SelectItem value="recent">Más recientes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time filter (single select) */}
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Tiempo" />
              </SelectTrigger>
              <SelectContent>
                {TIME_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Multi streamer filter */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <FavoriteStreamersMenu
              favorites={favorites}
              onSelect={(fav) => {
                if (!selectedStreamers.find(s => s.name.toLowerCase() === fav.name.toLowerCase())) {
                  setSelectedStreamers(prev => [...prev, fav]);
                }
              }}
              onRemove={removeFavorite}
              onClear={clearFavorites}
            />
            <div className="relative">

              <Input
                ref={inputRef}
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
                  // Delay to allow clicking on suggestions
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                className="w-[180px] h-9"
              />
              {showSuggestions && channelSuggestions.length > 0 && (
                <div className="absolute top-full left-0 z-50 mt-1 w-[280px] rounded-md border bg-popover p-1 shadow-md">
                  <div className="max-h-[300px] overflow-y-auto">
                    {channelSuggestions.map((channel) => (
                      <div key={channel.id} className="flex items-center gap-1 rounded-md hover:bg-accent">
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectChannel(channel)}
                          className="flex flex-1 items-center gap-3 p-2 transition-colors text-left min-w-0"
                        >
                          <img src={channel.thumbnail_url} alt={channel.display_name} className="w-8 h-8 rounded-full" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{channel.display_name}</span>
                              {channel.is_live && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 flex items-center gap-1">
                                  <Radio className="h-2 w-2" /> LIVE
                                </Badge>
                              )}
                            </div>
                            {channel.game_name && (
                              <span className="text-xs text-muted-foreground truncate block">{channel.game_name}</span>
                            )}
                          </div>
                        </button>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => toggleFavorite({ name: channel.display_name, avatar: channel.thumbnail_url })}
                          className="p-2 text-muted-foreground hover:text-primary"
                          title={isFavorite(channel.display_name) ? "Quitar de favoritos" : "Guardar en favoritos"}
                        >
                          <Star className={`h-4 w-4 ${isFavorite(channel.display_name) ? "fill-current text-primary" : ""}`} />
                        </button>
                      </div>
                    ))}
                  </div>

                </div>
              )}
              {isSearchingChannels && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          
          {/* View mode toggle */}
          <div className="flex items-center gap-2 border-l border-border pl-3">
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
              <Button
                variant={!hideViewed && !showOnlyViewed ? "default" : "ghost"}
                size="sm"
                onClick={() => { setHideViewed(false); setShowOnlyViewed(false); }}
                className="h-7 text-xs"
              >
                Todos
              </Button>
              <Button
                variant={hideViewed ? "default" : "ghost"}
                size="sm"
                onClick={() => { setHideViewed(true); setShowOnlyViewed(false); }}
                className="h-7 text-xs"
              >
                <EyeOff className="h-3 w-3 mr-1" /> Sin ver
              </Button>
              <Button
                variant={showOnlyViewed ? "default" : "ghost"}
                size="sm"
                onClick={() => { setShowOnlyViewed(true); setHideViewed(false); }}
                className="h-7 text-xs"
                disabled={viewedClips.size === 0}
              >
                <Eye className="h-3 w-3 mr-1" /> Vistos ({viewedClips.size})
              </Button>
            </div>
            {viewedClips.size > 0 && (
              <Button
                variant="ghost" size="sm" onClick={clearAllViewed}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3 mr-1" /> Limpiar
              </Button>
            )}
          </div>
        </div>
        
        {/* Active streamer filter badges */}
        {selectedStreamers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Streamers:</span>
            {selectedStreamers.map((s) => (
              <Badge key={s.name} variant="secondary" className="text-xs flex items-center gap-1">
                {s.avatar && <img src={s.avatar} alt="" className="w-4 h-4 rounded-full" />}
                <span>{s.name}</span>
                <button
                  onClick={() => toggleFavorite(s)}
                  className="hover:text-primary"
                  title={isFavorite(s.name) ? "Quitar de favoritos" : "Guardar en favoritos"}
                >
                  <Star className={`h-3 w-3 ${isFavorite(s.name) ? "fill-current text-primary" : ""}`} />
                </button>

                <button onClick={() => removeStreamer(s.name)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost" size="sm"
              onClick={() => setSelectedStreamers([])}
              className="h-6 text-xs text-muted-foreground hover:text-destructive px-1"
            >
              Limpiar
            </Button>
          </div>
        )}
      </div>

      {(isLoading && clips.length === 0) || (showOnlyViewed && isLoadingViewed && filteredClips.length === 0) ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">{showOnlyViewed ? 'Recuperando clips vistos...' : 'Cargando clips trending...'}</span>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={() => fetchTrendingClips(true)}>Reintentar</Button>
        </div>
      ) : filteredClips.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flame className="h-12 w-12 mx-auto mb-3 opacity-50" />
           <p>{showOnlyViewed ? 'No hay clips vistos disponibles para el streamer seleccionado' : hideViewed && clips.length > 0 ? 'Todos los clips han sido marcados como vistos' : 'No se encontraron clips con los filtros seleccionados'}</p>
           <p className="text-sm mt-2">{showOnlyViewed ? 'Los clips eliminados o expirados en Twitch no se pueden recuperar' : hideViewed && clips.length > 0 ? 'Cambia a “Todos” o limpia el historial' : 'Prueba con otros filtros'}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredClips.map((clip, index) => (
              <div
                key={clip.id}
                className={`group relative rounded-lg overflow-hidden bg-secondary border transition-all hover:scale-[1.02] ${
                  viewedClips.has(clip.id) ? 'border-muted opacity-60' : 'border-border hover:border-primary'
                }`}
              >
                <a href={clip.url} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="relative aspect-video">
                    <img src={clip.thumbnail_url} alt={clip.title} className="w-full h-full object-cover" loading="lazy" />
                    {index < 3 && !hideViewed && (
                      <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-yellow-950' :
                        index === 1 ? 'bg-gray-300 text-gray-800' :
                        'bg-amber-600 text-amber-950'
                      }`}>{index + 1}</div>
                    )}
                    {viewedClips.has(clip.id) && (
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-muted/90 text-xs font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Visto
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-background/80 text-xs font-medium">
                      {formatDuration(clip.duration)}
                    </div>
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ExternalLink className="h-8 w-8 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-medium text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">{clip.title}</h4>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate max-w-[60%]">{clip.broadcaster_name}</span>
                      <div className="flex items-center gap-1"><Eye className="h-3 w-3" /><span>{formatViewCount(clip.view_count)}</span></div>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                      <span className="truncate max-w-[60%]">{clip.game_name}</span>
                      <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>{getTimeAgo(clip.created_at)}</span></div>
                    </div>
                  </div>
                </a>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={(e) => handleDownloadClip(clip, e)} className="h-7 px-2 bg-background/90 hover:bg-background" title="Descargar clip">
                    <Download className="h-3 w-3 mr-1" /> Descargar
                  </Button>
                  <Button
                    variant={viewedClips.has(clip.id) ? "secondary" : "ghost"}
                    size="sm" onClick={(e) => toggleViewedClip(clip, e)}
                    className="h-7 px-2 bg-background/90 hover:bg-background"
                  >
                    {viewedClips.has(clip.id) ? (<><X className="h-3 w-3 mr-1" /> Quitar</>) : (<><Check className="h-3 w-3 mr-1" /> Visto</>)}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div ref={loadMoreRef} className="mt-8 flex justify-center">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /><span>Cargando más clips...</span>
              </div>
            )}
            {!isLoadingMore && nextCursor && (
              <Button variant="outline" onClick={loadMore}>Cargar más clips</Button>
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

export default TrendingClips;
