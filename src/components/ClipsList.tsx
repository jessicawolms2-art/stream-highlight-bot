import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MessageSquare, Download, Play } from "lucide-react";

interface Clip {
  id: string;
  timestamp: string;
  duration: number;
  messageCount: number;
  peakMessages: number;
}

interface ClipsListProps {
  clips: Clip[];
}

const ClipsList = ({ clips }: ClipsListProps) => {
  return (
    <Card className="p-6 bg-card border-border shadow-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Clips Detectados</h3>
        <Badge variant="secondary" className="text-sm">
          {clips.length} clips
        </Badge>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {clips.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No se han detectado clips aún</p>
            <p className="text-sm mt-1">Ajusta los parámetros o analiza un stream</p>
          </div>
        ) : (
          clips.map((clip) => (
            <div
              key={clip.id}
              className="flex items-center justify-between p-4 rounded-lg bg-secondary border border-border hover:border-primary transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Play className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {clip.timestamp}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{clip.duration}s</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{clip.peakMessages} msg/s pico</span>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default ClipsList;
