import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, ExternalLink, Users, Eye, Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TwitchChannel {
  id: string;
  broadcaster_login: string;
  display_name: string;
  thumbnail_url: string;
  is_live: boolean;
  game_name?: string;
  title?: string;
  started_at?: string;
}

interface KickChannel {
  id: string;
  slug: string;
  username: string;
  profile_pic: string;
  is_live: boolean;
  viewer_count?: number;
  category?: string;
}

const StreamerSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [platform, setPlatform] = useState<"twitch" | "kick">("twitch");
  const [isSearching, setIsSearching] = useState(false);
  const [twitchResults, setTwitchResults] = useState<TwitchChannel[]>([]);
  const [kickResults, setKickResults] = useState<KickChannel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const searchTwitch = async (query: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-top-clips', {
        body: { 
          action: 'search_channels',
          query 
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data.channels || [];
    } catch (err) {
      console.error('Error searching Twitch:', err);
      throw err;
    }
  };

  const searchKick = async (query: string) => {
    try {
      const response = await fetch(`https://kick.com/api/v2/search?query=${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) throw new Error('Failed to search Kick');
      
      const data = await response.json();
      return data.channels || [];
    } catch (err) {
      console.error('Error searching Kick:', err);
      // Fallback: try to directly access the channel
      try {
        const directResponse = await fetch(`https://kick.com/api/v2/channels/${query.toLowerCase()}`, {
          headers: { 'Accept': 'application/json' },
        });
        
        if (directResponse.ok) {
          const channel = await directResponse.json();
          return [channel];
        }
      } catch {
        // Ignore fallback error
      }
      throw err;
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      if (platform === "twitch") {
        const channels = await searchTwitch(searchQuery);
        setTwitchResults(channels);
        setKickResults([]);
      } else {
        const { data, error } = await supabase.functions.invoke('get-kick-clips', {
          body: { 
            action: 'search_channels',
            query: searchQuery 
          }
        });
        
        if (error) throw error;
        setKickResults(data.channels || []);
        setTwitchResults([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Error al buscar');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const openTwitchChannel = (login: string) => {
    window.open(`https://www.twitch.tv/${login}`, '_blank');
  };

  const openKickChannel = (slug: string) => {
    window.open(`https://kick.com/${slug}`, '_blank');
  };

  return (
    <Card className="p-6 bg-card border-border shadow-card">
      <div className="flex items-center gap-2 mb-6">
        <Search className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          Buscar Streamers
        </h3>
      </div>

      <Tabs value={platform} onValueChange={(v) => setPlatform(v as "twitch" | "kick")} className="mb-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="twitch" className="data-[state=active]:bg-[#9146FF] data-[state=active]:text-white">
            Twitch
          </TabsTrigger>
          <TabsTrigger value="kick" className="data-[state=active]:bg-[#53fc18] data-[state=active]:text-black">
            Kick
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder={`Buscar streamer en ${platform === 'twitch' ? 'Twitch' : 'Kick'}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button 
          onClick={handleSearch} 
          disabled={isSearching || !searchQuery.trim()}
          className={platform === 'twitch' ? 'bg-[#9146FF] hover:bg-[#9146FF]/90' : 'bg-[#53fc18] hover:bg-[#53fc18]/90 text-black'}
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {error && (
        <div className="text-center py-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Twitch Results */}
      {platform === "twitch" && twitchResults.length > 0 && (
        <div className="space-y-3">
          {twitchResults.map((channel) => (
            <div
              key={channel.id}
              onClick={() => openTwitchChannel(channel.broadcaster_login)}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 cursor-pointer transition-all border border-transparent hover:border-[#9146FF]"
            >
              <img
                src={channel.thumbnail_url || '/placeholder.svg'}
                alt={channel.display_name}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{channel.display_name}</span>
                  {channel.is_live && (
                    <Badge className="bg-red-500 text-white text-xs">EN VIVO</Badge>
                  )}
                </div>
                {channel.game_name && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Gamepad2 className="h-3 w-3" />
                    <span className="truncate">{channel.game_name}</span>
                  </div>
                )}
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}

      {/* Kick Results */}
      {platform === "kick" && kickResults.length > 0 && (
        <div className="space-y-3">
          {kickResults.map((channel) => (
            <div
              key={channel.id || channel.slug}
              onClick={() => openKickChannel(channel.slug)}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 cursor-pointer transition-all border border-transparent hover:border-[#53fc18]"
            >
              <img
                src={channel.profile_pic || '/placeholder.svg'}
                alt={channel.username}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{channel.username}</span>
                  {channel.is_live && (
                    <Badge className="bg-red-500 text-white text-xs">EN VIVO</Badge>
                  )}
                </div>
                {channel.viewer_count !== undefined && channel.is_live && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Eye className="h-3 w-3" />
                    <span>{channel.viewer_count.toLocaleString()} viendo</span>
                  </div>
                )}
                {channel.category && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Gamepad2 className="h-3 w-3" />
                    <span className="truncate">{channel.category}</span>
                  </div>
                )}
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isSearching && searchQuery && 
        ((platform === "twitch" && twitchResults.length === 0) || 
         (platform === "kick" && kickResults.length === 0)) && 
        !error && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No se encontraron streamers</p>
          <p className="text-sm">Intenta con otro nombre</p>
        </div>
      )}

      {/* Initial state */}
      {!searchQuery && twitchResults.length === 0 && kickResults.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Escribe el nombre de un streamer</p>
          <p className="text-sm">para buscarlo en {platform === 'twitch' ? 'Twitch' : 'Kick'}</p>
        </div>
      )}
    </Card>
  );
};

export default StreamerSearch;
