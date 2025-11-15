import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface DataPoint {
  time: string;
  messages: number;
}

interface ActivityTimelineProps {
  data: DataPoint[];
  threshold: number;
}

const ActivityTimeline = ({ data, threshold }: ActivityTimelineProps) => {
  const maxMessages = Math.max(...data.map(d => d.messages), threshold);

  return (
    <Card className="p-6 bg-card border-border shadow-card">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Actividad del Chat</h3>
      </div>

      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground">
          <p>Los datos de actividad aparecerán aquí después del análisis</p>
        </div>
      ) : (
        <div className="relative h-48">
          <div className="absolute inset-0 flex items-end gap-1">
            {data.map((point, index) => {
              const height = (point.messages / maxMessages) * 100;
              const isAboveThreshold = point.messages >= threshold;
              
              return (
                <div
                  key={index}
                  className="flex-1 relative group cursor-pointer"
                  style={{ height: '100%' }}
                >
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-t transition-all ${
                      isAboveThreshold
                        ? 'bg-gradient-accent shadow-glow'
                        : 'bg-primary/40'
                    } group-hover:opacity-80`}
                    style={{ height: `${height}%` }}
                  />
                  
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                    <div className="font-semibold">{point.time}</div>
                    <div className="text-muted-foreground">{point.messages} msg/s</div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div
            className="absolute left-0 right-0 border-t border-dashed border-accent"
            style={{ bottom: `${(threshold / maxMessages) * 100}%` }}
          >
            <span className="absolute -top-3 right-0 text-xs text-accent font-medium bg-background px-1">
              Umbral: {threshold} msg/s
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ActivityTimeline;
