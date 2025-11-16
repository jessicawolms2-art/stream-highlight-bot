import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface VideoPlayerProps {
  videoId: string;
  clipStart?: number;
  clipDuration?: number;
  title?: string;
  onDownload?: () => void;
}

const VideoPlayer = ({ videoId, clipStart = 0, clipDuration, title, onDownload }: VideoPlayerProps) => {
  // Construir URL del iframe de Twitch con el timestamp
  const timeParam = clipStart > 0 ? `&time=${Math.floor(clipStart / 3600)}h${Math.floor((clipStart % 3600) / 60)}m${Math.floor(clipStart % 60)}s` : '';
  const embedUrl = `https://player.twitch.tv/?video=${videoId}&parent=${window.location.hostname}&autoplay=false${timeParam}`;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="overflow-hidden bg-card border-border shadow-card">
      {title && (
        <div className="p-4 border-b border-border bg-muted/50">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {clipStart > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Clip desde {formatTime(clipStart)} ({clipDuration}s de duración)
            </p>
          )}
        </div>
      )}
      
      <div className="relative bg-black">
        <iframe
          src={embedUrl}
          className="w-full aspect-video"
          allowFullScreen
          title="Twitch Video Player"
        />
        
        {onDownload && (
          <div className="p-4 border-t border-border bg-muted/50">
            <Button
              size="sm"
              variant="outline"
              onClick={onDownload}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Clip
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default VideoPlayer;
