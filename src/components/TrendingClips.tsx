import { useEffect, useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Flame, Eye, Clock, ExternalLink, Loader2, RefreshCw, Globe, Gamepad2, Timer, User, X, EyeOff, Check, Radio, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

const LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'ko', name: '한국어' },
  { code: 'ja', name: '日本語' },
  { code: 'all', name: 'Todos los idiomas' },
];

const TIME_FILTERS = [
  { value: '1h', label: '1 hora', hours: 1 },
  { value: '2h', label: '2 horas', hours: 2 },
  { value: '3h', label: '3 horas', hours: 3 },
  { value: '6h', label: '6 horas', hours: 6 },
  { value: '12h', label: '12 horas', hours: 12 },
  { value: '24h', label: '24 horas', hours: 24 },
  { value: '3d', label: '3 días', hours: 72 },
  { value: '7d', label: '1 semana', hours: 168 },
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
  const [language, setLanguage] = useState('es');
  const [gameId, setGameId] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState('24h');
  const [streamerFilter, setStreamerFilter] = useState('');
  const [streamerInput, setStreamerInput] = useState('');
  const [selectedStreamerAvatar, setSelectedStreamerAvatar] = useState<string | null>(null);
  const [channelSuggestions, setChannelSuggestions] = useState<TwitchChannel[]>([]);
  const [isSearchingChannels, setIsSearchingChannels] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [totalFound, setTotalFound] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [viewedClips, setViewedClips] = useState<Set<string>>(getViewedClips);
  const [hideViewed, setHideViewed] = useState(false);
  const [showOnlyViewed, setShowOnlyViewed] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Download clip function - opens clipsey.com with the clip URL
  const handleDownloadClip = (clip: TrendingClip, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Open clipsey.com - user will paste the URL there
    // Clipsey doesn't support URL parameters, so we copy to clipboard and open the site
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
    
    try {
      const { data, error } = await supabase.functions.invoke('get-top-clips', {
        body: { 
          language, 
          limit: 20,
          cursor: cursorToUse,
          gameId: gameId === 'all' ? undefined : gameId,
          timeFilter,
          broadcasterName: streamerFilter || undefined,
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
  }, [language, gameId, timeFilter, streamerFilter]);

  const loadMore = useCallback(() => {
    if (nextCursor && !isLoadingMore && !isLoading) {
      fetchTrendingClips(false, nextCursor);
    }
  }, [nextCursor, isLoadingMore, isLoading, language, gameId, timeFilter, streamerFilter]);

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
    
    // Debounce the search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchChannels(value);
    }, 300);
  };

  const selectChannel = (channel: TwitchChannel) => {
    setStreamerInput(channel.display_name);
    setStreamerFilter(channel.display_name);
    setSelectedStreamerAvatar(channel.thumbnail_url);
    setShowSuggestions(false);
    setChannelSuggestions([]);
  };

  const handleStreamerKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setStreamerFilter(streamerInput.trim());
      setShowSuggestions(false);
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const clearStreamerFilter = () => {
    setStreamerFilter('');
    setStreamerInput('');
    setSelectedStreamerAvatar(null);
    setChannelSuggestions([]);
  };

  const toggleViewedClip = (clip: TrendingClip, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewedClips(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clip.id)) {
        newSet.delete(clip.id);
        removeViewedClipData(clip.id);
      } else {
        newSet.add(clip.id);
        saveViewedClipData({
          id: clip.id,
          title: clip.title,
          broadcaster_name: clip.broadcaster_name,
          game_name: clip.game_name,
          thumbnail_url: clip.thumbnail_url,
          view_count: clip.view_count,
          duration: clip.duration,
          created_at: clip.created_at,
          url: clip.url,
          embed_url: clip.embed_url,
        });
      }
      saveViewedClips(newSet);
      return newSet;
    });
  };

  const clearAllViewed = () => {
    setViewedClips(new Set());
    localStorage.removeItem(VIEWED_CLIPS_KEY);
    localStorage.removeItem(VIEWED_CLIPS_DATA_KEY);
  };

  // Get clips to display - when showing only viewed, use stored data
  const getDisplayClips = (): TrendingClip[] => {
    if (showOnlyViewed) {
      const storedData = getViewedClipsData();
      return Array.from(storedData.values()).map(clip => ({
        ...clip,
        language: undefined,
      }));
    }
    if (hideViewed) {
      return clips.filter(clip => !viewedClips.has(clip.id));
    }
    return clips;
  };

  const filteredClips = getDisplayClips();

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

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
  };

  const handleGameChange = (newGameId: string) => {
    setGameId(newGameId);
  };

  const handleTimeFilterChange = (newTimeFilter: string) => {
    setTimeFilter(newTimeFilter);
  };

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
            <Badge variant="outline" className="text-xs">
              Twitch
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
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
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            <Select value={gameId} onValueChange={handleGameChange}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {games.map((game) => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Idioma" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Tiempo" />
              </SelectTrigger>
              <SelectContent>
                {TIME_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Streamer filter with autocomplete */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="relative">
              <Popover open={showSuggestions && channelSuggestions.length > 0} onOpenChange={setShowSuggestions}>
                <PopoverTrigger asChild>
                  <div className="flex gap-1">
                    <div className="relative">
                      {selectedStreamerAvatar && streamerFilter && (
                        <img
                          src={selectedStreamerAvatar}
                          alt=""
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full"
                        />
                      )}
                      <Input
                        ref={inputRef}
                        placeholder="Buscar streamer..."
                        value={streamerInput}
                        onChange={(e) => handleStreamerInputChange(e.target.value)}
                        onKeyDown={handleStreamerKeyPress}
                        onFocus={() => streamerInput.length >= 2 && setShowSuggestions(true)}
                        className={`w-[200px] h-9 ${selectedStreamerAvatar && streamerFilter ? 'pl-9' : ''}`}
                      />
                      {isSearchingChannels && (
                        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {streamerFilter && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearStreamerFilter}
                        className="h-9 w-9"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[280px] p-1" 
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="max-h-[300px] overflow-y-auto">
                    {channelSuggestions.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => selectChannel(channel)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-accent rounded-md transition-colors text-left"
                      >
                        <img
                          src={channel.thumbnail_url}
                          alt={channel.display_name}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{channel.display_name}</span>
                            {channel.is_live && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 flex items-center gap-1">
                                <Radio className="h-2 w-2" />
                                LIVE
                              </Badge>
                            )}
                          </div>
                          {channel.game_name && (
                            <span className="text-xs text-muted-foreground truncate block">
                              {channel.game_name}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
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
                <EyeOff className="h-3 w-3 mr-1" />
                Sin ver
              </Button>
              <Button
                variant={showOnlyViewed ? "default" : "ghost"}
                size="sm"
                onClick={() => { setShowOnlyViewed(true); setHideViewed(false); }}
                className="h-7 text-xs"
                disabled={viewedClips.size === 0}
              >
                <Eye className="h-3 w-3 mr-1" />
                Vistos ({viewedClips.size})
              </Button>
            </div>
            {viewedClips.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllViewed}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </div>
        
        {/* Active streamer filter badge */}
        {streamerFilter && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              {selectedStreamerAvatar && (
                <img src={selectedStreamerAvatar} alt="" className="w-4 h-4 rounded-full" />
              )}
              <span>Streamer: {streamerFilter}</span>
              <button onClick={clearStreamerFilter} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      {isLoading && clips.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Cargando clips trending en {LANGUAGES.find(l => l.code === language)?.name}...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={() => fetchTrendingClips(true)}>
            Reintentar
          </Button>
        </div>
      ) : filteredClips.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flame className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{hideViewed && clips.length > 0 ? 'Todos los clips han sido marcados como vistos' : 'No se encontraron clips con los filtros seleccionados'}</p>
          <p className="text-sm mt-2">{hideViewed && clips.length > 0 ? 'Desactiva "Ocultar vistos" o limpia el historial' : 'Prueba con otros filtros'}</p>
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
                <a
                  href={clip.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video">
                    <img
                      src={clip.thumbnail_url}
                      alt={clip.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Rank badge */}
                    {index < 3 && !hideViewed && (
                      <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-yellow-950' :
                        index === 1 ? 'bg-gray-300 text-gray-800' :
                        'bg-amber-600 text-amber-950'
                      }`}>
                        {index + 1}
                      </div>
                    )}
                    {/* Viewed badge */}
                    {viewedClips.has(clip.id) && (
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-muted/90 text-xs font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Visto
                      </div>
                    )}
                    {/* Duration */}
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-background/80 text-xs font-medium">
                      {formatDuration(clip.duration)}
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ExternalLink className="h-8 w-8 text-primary-foreground" />
                    </div>
                  </div>
                  
                  {/* Info */}
                  <div className="p-3">
                    <h4 className="text-sm font-medium text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {clip.title}
                    </h4>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate max-w-[60%]">{clip.broadcaster_name}</span>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{formatViewCount(clip.view_count)}</span>
                      </div>
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
                
                {/* Action buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Download button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDownloadClip(clip, e)}
                    className="h-7 px-2 bg-background/90 hover:bg-background"
                    title="Descargar clip"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Descargar
                  </Button>
                  
                  {/* Mark as viewed button */}
                  <Button
                    variant={viewedClips.has(clip.id) ? "secondary" : "ghost"}
                    size="sm"
                    onClick={(e) => toggleViewedClip(clip, e)}
                    className="h-7 px-2 bg-background/90 hover:bg-background"
                  >
                    {viewedClips.has(clip.id) ? (
                      <>
                        <X className="h-3 w-3 mr-1" />
                        Quitar
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Visto
                      </>
                    )}
                  </Button>
                </div>
              </div>
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

export default TrendingClips;
