import { useState } from "react";
import UrlInput from "@/components/UrlInput";
import ParametersConfig from "@/components/ParametersConfig";
import ClipsList from "@/components/ClipsList";
import ActivityTimeline from "@/components/ActivityTimeline";
import StatsOverview from "@/components/StatsOverview";
import VideoPlayer from "@/components/VideoPlayer";
import TrendingClips from "@/components/TrendingClips";
import { Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messageThreshold, setMessageThreshold] = useState(80);
  const [clipDuration, setClipDuration] = useState(30);
  const [sensitivity, setSensitivity] = useState(2);
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [selectedClip, setSelectedClip] = useState<any>(null);
  
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
    setSelectedClip(null);
    setCurrentVideo(null);
    setTimelineData([]);
    setClips([]);
    
    const platform = url.includes('kick.com') ? 'kick' : 'twitch';
    
    toast({
      title: "Iniciando análisis",
      description: `Conectando con ${platform === 'kick' ? 'Kick' : 'Twitch'}...`,
    });

    try {
      const { data, error } = await supabase.functions.invoke('analyze-twitch', {
        body: { 
          videoUrl: url,
          threshold: messageThreshold 
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('Analysis result:', data);

      setCurrentVideo(data.video);
      setTimelineData(data.activityData);
      setClips(data.clips);
      setStats({
        totalMessages: data.stats.totalMessages,
        clipsGenerated: data.clips.length,
        avgMessagesPerSecond: data.stats.avgMessagesPerSecond,
        streamDuration: data.stats.duration,
      });

      toast({
        title: "Análisis completado",
        description: `Se detectaron ${data.clips.length} clips potenciales`,
      });
    } catch (error) {
      console.error('Error analyzing:', error);
      toast({
        title: "Error en el análisis",
        description: error instanceof Error ? error.message : "No se pudo analizar el video",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePlayClip = (clip: any) => {
    setSelectedClip(clip);
    // Scroll to video player
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadClip = async (clip: any) => {
    const h = Math.floor(clip.startTime / 3600);
    const m = Math.floor((clip.startTime % 3600) / 60);
    const s = Math.floor(clip.startTime % 60);
    const tParam = `${h > 0 ? `${h}h` : ""}${m}m${s}s`;
    const vodUrl =
      currentVideo?.url
        ? `${currentVideo.url}${currentVideo.url.includes("?") ? "&" : "?"}t=${tParam}`
        : `https://www.twitch.tv/videos/${currentVideo?.id}?t=${tParam}`;

    window.open(vodUrl, "_blank", "noopener");

    toast({
      title: "Abriendo clip",
      description: "Te llevamos al VOD en la marca de tiempo del clip.",
    });
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

        {/* Video Player */}
        {(currentVideo || selectedClip) && (
          <div className="mb-8">
          <VideoPlayer
            videoId={currentVideo?.id || ""}
            clipStart={selectedClip?.startTime}
            clipDuration={selectedClip?.duration}
            title={selectedClip ? `Clip en ${selectedClip.timestamp}` : currentVideo?.title}
            onDownload={selectedClip ? () => handleDownloadClip(selectedClip) : undefined}
            platform={currentVideo?.platform || 'twitch'}
            videoUrl={currentVideo?.url}
          />
          </div>
        )}

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
            <ClipsList 
              clips={clips} 
              onPlayClip={handlePlayClip}
              onDownloadClip={handleDownloadClip}
            />
          </div>
        </div>

        {/* Trending Clips Section */}
        <div className="mt-8">
          <TrendingClips />
        </div>
      </div>
    </div>
  );
};

export default Index;
