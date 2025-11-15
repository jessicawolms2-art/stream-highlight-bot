import { Card } from "@/components/ui/card";
import { MessageSquare, Scissors, Clock, TrendingUp } from "lucide-react";

interface StatsOverviewProps {
  totalMessages: number;
  clipsGenerated: number;
  avgMessagesPerSecond: number;
  streamDuration: string;
}

const StatsOverview = ({
  totalMessages,
  clipsGenerated,
  avgMessagesPerSecond,
  streamDuration,
}: StatsOverviewProps) => {
  const stats = [
    {
      icon: MessageSquare,
      label: "Mensajes Totales",
      value: totalMessages.toLocaleString(),
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Scissors,
      label: "Clips Generados",
      value: clipsGenerated,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      icon: TrendingUp,
      label: "Promedio msg/s",
      value: avgMessagesPerSecond.toFixed(1),
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Clock,
      label: "Duración",
      value: streamDuration,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className="p-6 bg-card border-border shadow-card hover:shadow-glow transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default StatsOverview;
