import { useCallback, useEffect, useState } from "react";

export interface FavoriteStreamer {
  name: string;
  avatar?: string;
}

const storageKey = (platform: "twitch" | "kick") => `favorite_streamers_${platform}`;

const readFavorites = (platform: "twitch" | "kick"): FavoriteStreamer[] => {
  try {
    const raw = localStorage.getItem(storageKey(platform));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is FavoriteStreamer => !!s && typeof s.name === "string");
  } catch {
    return [];
  }
};

/**
 * Persisted list of favorite streamer profiles per platform (localStorage).
 */
export const useFavoriteStreamers = (platform: "twitch" | "kick") => {
  const [favorites, setFavorites] = useState<FavoriteStreamer[]>(() => readFavorites(platform));

  useEffect(() => {
    localStorage.setItem(storageKey(platform), JSON.stringify(favorites));
  }, [favorites, platform]);

  const isFavorite = useCallback(
    (name: string) => favorites.some(f => f.name.toLowerCase() === name.toLowerCase()),
    [favorites]
  );

  const toggleFavorite = useCallback((streamer: FavoriteStreamer) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.name.toLowerCase() === streamer.name.toLowerCase());
      if (exists) return prev.filter(f => f.name.toLowerCase() !== streamer.name.toLowerCase());
      return [...prev, streamer];
    });
  }, []);

  const removeFavorite = useCallback((name: string) => {
    setFavorites(prev => prev.filter(f => f.name.toLowerCase() !== name.toLowerCase()));
  }, []);

  const clearFavorites = useCallback(() => setFavorites([]), []);

  return { favorites, isFavorite, toggleFavorite, removeFavorite, clearFavorites };
};
