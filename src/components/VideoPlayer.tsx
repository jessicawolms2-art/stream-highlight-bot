import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Play } from "lucide-react";

interface VideoPlayerProps {
  videoId: string;
  clipStart?: number;
  clipDuration?: number;
  title?: string;
  onDownload?: () => void;
  platform?: 'twitch' | 'kick';
  videoUrl?: string;
}

const VideoPlayer = ({ videoId, clipStart = 0, clipDuration, title, onDownload, platform = 'twitch', videoUrl }: VideoPlayerProps) => {
  // Construir URL del iframe según la plataforma
  let embedUrl = '';
  let linkTimeParam = '';
  let externalUrl = '';
  
  if (platform === 'kick') {
    // Para Kick, usamos el URL directo ya que no tienen un iframe embebido confiable
    externalUrl = videoUrl || `https://kick.com/video/${videoId}`;
    embedUrl = externalUrl;
    linkTimeParam = ''; // Kick no soporta timestamps en URL de la misma forma
  } else {
    // Twitch
    const timeParam = clipStart > 0 ? `&time=${Math.floor(clipStart / 3600)}h${Math.floor((clipStart % 3600) / 60)}m${Math.floor(clipStart % 60)}s` : '';
    linkTimeParam = clipStart > 0 ? `?t=${Math.floor(clipStart / 3600)}h${Math.floor((clipStart % 3600) / 60)}m${Math.floor(clipStart % 60)}s` : '';
    const parentHost = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "localhost";
    embedUrl = `https://player.twitch.tv/?video=${videoId}&parent=${parentHost}&parent=localhost&autoplay=false${timeParam}`;
    externalUrl = `https://www.twitch.tv/videos/${videoId}${linkTimeParam}`;
  }

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
        {platform === 'kick' ? (
          <div className="w-full aspect-video flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
            <div className="text-center p-6">
              <p className="text-white text-lg mb-4">
                Los VODs de Kick deben verse en su plataforma
              </p>
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#53fc18] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#42ca13] transition-colors"
              >
                <Play className="h-5 w-5" />
                Abrir en Kick
              </a>
            </div>
          </div>
        ) : (
          <>
            <iframe
              src={embedUrl}
              className="w-full aspect-video"
              allowFullScreen
              title="Twitch Video Player"
            />
            <div className="p-3 text-sm text-muted-foreground border-t border-border bg-muted/30">
              ¿No se carga el reproductor o aparece en gris?
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline text-primary"
              >
                Abrir en Twitch
              </a>
            </div>
          </>
        )}
        
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
