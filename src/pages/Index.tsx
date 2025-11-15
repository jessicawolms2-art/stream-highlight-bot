import { useState } from "react";
import UrlInput from "@/components/UrlInput";
import ParametersConfig from "@/components/ParametersConfig";
import ClipsList from "@/components/ClipsList";
import ActivityTimeline from "@/components/ActivityTimeline";
import StatsOverview from "@/components/StatsOverview";
import { Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messageThreshold, setMessageThreshold] = useState(80);
  const [clipDuration, setClipDuration] = useState(30);
  const [sensitivity, setSensitivity] = useState(2);
  
  // Mock data - esto se reemplazará con datos reales del análisis
  const [clips, setClips] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalMessages: 0,
    clipsGenerated: 0,
    avgMessagesPerSecond: 0,
    streamDuration: "0:00:00",
  });

  const handleAnalyze = async (url: string) => {
    setIsAnalyzing(true);
    toast({
      title: "Iniciando análisis",
      description: "Procesando el stream...",
    });

    // Simulación de análisis - esto se reemplazará con lógica real
    setTimeout(() => {
      // Datos de ejemplo para demostración
      const mockTimelineData = Array.from({ length: 50 }, (_, i) => ({
        time: `${Math.floor(i / 2)}:${(i % 2) * 30}`,
        messages: Math.floor(Math.random() * 150) + 20,
      }));

      const mockClips = mockTimelineData
        .map((point, index) => ({
          id: `clip-${index}`,
          timestamp: point.time,
          duration: clipDuration,
          messageCount: point.messages,
          peakMessages: point.messages,
        }))
        .filter((clip) => clip.messageCount >= messageThreshold)
        .slice(0, 8);

      setTimelineData(mockTimelineData);
      setClips(mockClips);
      setStats({
        totalMessages: 45320,
        clipsGenerated: mockClips.length,
        avgMessagesPerSecond: 42.3,
        streamDuration: "2:15:30",
      });

      setIsAnalyzing(false);
      toast({
        title: "Análisis completado",
        description: `Se detectaron ${mockClips.length} clips potenciales`,
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-primary">
              <Scissors className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              ClipMatic
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Genera clips automáticos de tus streams de Twitch o Kick basándote en la actividad del chat
          </p>
        </div>

        {/* URL Input */}
        <div className="flex justify-center mb-12">
          <UrlInput onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
        </div>

        {/* Stats Overview */}
        {clips.length > 0 && (
          <div className="mb-8">
            <StatsOverview {...stats} />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column: Parameters */}
          <div className="lg:col-span-1">
            <ParametersConfig
              messageThreshold={messageThreshold}
              setMessageThreshold={setMessageThreshold}
              clipDuration={clipDuration}
              setClipDuration={setClipDuration}
              sensitivity={sensitivity}
              setSensitivity={setSensitivity}
            />
          </div>

          {/* Right Column: Timeline and Clips */}
          <div className="lg:col-span-2 space-y-6">
            <ActivityTimeline data={timelineData} threshold={messageThreshold} />
            <ClipsList clips={clips} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
