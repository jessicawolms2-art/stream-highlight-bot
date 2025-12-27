import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Eye, Clock, ExternalLink, Loader2, RefreshCw } from "lucide-react";
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
}

const TrendingClips = () => {
  const [clips, setClips] = useState<TrendingClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrendingClips = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('get-top-clips');
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setClips(data.clips || []);
    } catch (err) {
      console.error('Error fetching trending clips:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar clips');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendingClips();
  }, []);

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">
            Clips Trending (24h)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Twitch
          </Badge>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchTrendingClips}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Cargando clips trending...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={fetchTrendingClips}>
            Reintentar
          </Button>
        </div>
      ) : clips.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flame className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No se encontraron clips trending</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto">
          {clips.map((clip, index) => (
            <a
              key={clip.id}
              href={clip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-lg overflow-hidden bg-secondary border border-border hover:border-primary transition-all hover:scale-[1.02]"
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
          ))}
        </div>
      )}
    </Card>
  );
};

export default TrendingClips;
