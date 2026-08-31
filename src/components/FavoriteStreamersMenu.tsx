import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Star, X } from "lucide-react";
import { FavoriteStreamer } from "@/hooks/use-favorite-streamers";

interface FavoriteStreamersMenuProps {
  favorites: FavoriteStreamer[];
  onSelect: (streamer: FavoriteStreamer) => void;
  onRemove: (name: string) => void;
  onClear: () => void;
  accentClassName?: string;
}

const FavoriteStreamersMenu = ({
  favorites,
  onSelect,
  onRemove,
  onClear,
  accentClassName = "text-primary",
}: FavoriteStreamersMenuProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1 text-xs" title="Streamers favoritos">
          <Star className={`h-3.5 w-3.5 ${favorites.length > 0 ? `${accentClassName} fill-current` : "text-muted-foreground"}`} />
          Favoritos {favorites.length > 0 && `(${favorites.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-2" align="start">
        {favorites.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Aún no tienes favoritos. Busca un streamer y pulsa la estrella para guardarlo.
          </p>
        ) : (
          <>
            <div className="max-h-[260px] overflow-y-auto space-y-0.5">
              {favorites.map((fav) => (
                <div key={fav.name} className="flex items-center gap-2 rounded px-1 hover:bg-accent">
                  <button
                    onClick={() => { onSelect(fav); setOpen(false); }}
                    className="flex flex-1 items-center gap-2 py-1.5 text-left text-xs min-w-0"
                  >
                    {fav.avatar
                      ? <img src={fav.avatar} alt="" className="h-6 w-6 rounded-full shrink-0" />
                      : <Star className={`h-4 w-4 shrink-0 ${accentClassName}`} />}
                    <span className="truncate">{fav.name}</span>
                  </button>
                  <button onClick={() => onRemove(fav.name)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="mt-1 h-7 w-full text-xs text-muted-foreground hover:text-destructive"
            >
              Limpiar favoritos
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default FavoriteStreamersMenu;
