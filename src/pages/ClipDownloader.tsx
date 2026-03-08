import { useState, useCallback } from "react";
import { Download, Link2, Loader2, Play, User, Calendar, Gamepad2, ChevronDown, Sparkles, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface ClipData {
  title: string;
  streamer: string;
  game: string;
  createdAt: string;
  thumbnailUrl: string;
  duration: number;
  viewCount: number;
  qualities: { label: string; url: string }[];
}

// Mock function — replace with real API call (RapidAPI, yt-dlp backend, etc.)
const fetchClipData = async (url: string): Promise<ClipData> => {
  await new Promise((r) => setTimeout(r, 2000));

  // Extract slug from URL for a realistic feel
  const slug = url.split("/").pop() || "clip";

  return {
    title: `Insane ${slug.replace(/-/g, " ")} Play`,
    streamer: "StreamerPro",
    game: "Valorant",
    createdAt: new Date().toISOString(),
    duration: 30,
    viewCount: 12400,
    thumbnailUrl: `https://static-cdn.jtvnw.net/previews-ttv/live_user_streamerpro-640x360.jpg`,
    qualities: [
      { label: "Original (1080p60)", url: `https://example.com/clip/${slug}/1080p60.mp4` },
      { label: "720p", url: `https://example.com/clip/${slug}/720p.mp4` },
      { label: "480p", url: `https://example.com/clip/${slug}/480p.mp4` },
      { label: "360p", url: `https://example.com/clip/${slug}/360p.mp4` },
    ],
  };
};

const ClipDownloader = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [clip, setClip] = useState<ClipData | null>(null);
  const [selectedQuality, setSelectedQuality] = useState(0);
  const [qualityOpen, setQualityOpen] = useState(false);

  const handleAnalyze = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast({ title: "URL requerida", description: "Pega un link de clip de Twitch.", variant: "destructive" });
      return;
    }
    if (!trimmed.includes("twitch.tv")) {
      toast({ title: "URL no válida", description: "Solo se aceptan links de Twitch.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setClip(null);
    try {
      const data = await fetchClipData(trimmed);
      setClip(data);
      setSelectedQuality(0);
    } catch {
      toast({ title: "Error", description: "No se pudo obtener el clip.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [url, toast]);

  const handleDownload = () => {
    if (!clip) return;
    const q = clip.qualities[selectedQuality];
    // In production, this would trigger a real download
    toast({ title: "Descarga iniciada", description: `Descargando en ${q.label}...` });
    // window.open(q.url, "_blank");
  };

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-[hsl(0,0%,95%)] flex flex-col items-center px-4 py-12 md:py-20 selection:bg-[hsl(264,100%,64%)]/30">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(264,100%,64%)] opacity-[0.06] blur-[120px]" />
      </div>

      {/* Back button */}
      <div className="relative z-10 w-full max-w-xl mb-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[hsl(0,0%,60%)] hover:text-[hsl(264,100%,80%)] transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Volver a ClipMatic
        </Link>
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-10 md:mb-14">
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-[hsl(264,60%,30%)] bg-[hsl(264,60%,12%)]/60 text-xs font-medium text-[hsl(264,100%,80%)] backdrop-blur-sm">
          <Sparkles className="h-3 w-3" />
          Twitch Clip Downloader
        </div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
          Descarga clips en{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(264,100%,64%)] to-[hsl(280,100%,70%)]">
            máxima calidad
          </span>
        </h1>
        <p className="text-sm md:text-base text-[hsl(0,0%,50%)] max-w-md mx-auto">
          Pega el link de cualquier clip de Twitch y descárgalo al instante en la resolución que prefieras.
        </p>
      </div>

      {/* Input */}
      <div className="relative z-10 w-full max-w-2xl mb-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(0,0%,40%)]" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://clips.twitch.tv/..."
              disabled={isLoading}
              className="pl-11 h-12 bg-[hsl(0,0%,8%)] border-[hsl(0,0%,16%)] text-sm placeholder:text-[hsl(0,0%,30%)] focus:border-[hsl(264,100%,64%)] focus:ring-[hsl(264,100%,64%)]/20 rounded-xl transition-all"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 px-6 rounded-xl font-semibold text-sm bg-[hsl(264,100%,64%)] hover:bg-[hsl(264,100%,58%)] text-white shadow-[0_0_24px_hsl(264,100%,64%,0.35)] hover:shadow-[0_0_32px_hsl(264,100%,64%,0.5)] transition-all duration-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Analizando
              </>
            ) : (
              "Analizar"
            )}
          </Button>
        </form>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="relative z-10 w-full max-w-2xl">
          <div className="rounded-2xl border border-[hsl(0,0%,14%)] bg-[hsl(0,0%,7%)]/80 backdrop-blur-xl p-5 space-y-4">
            <Skeleton className="w-full aspect-video rounded-xl bg-[hsl(0,0%,12%)]" />
            <Skeleton className="h-5 w-3/4 bg-[hsl(0,0%,12%)]" />
            <div className="flex gap-3">
              <Skeleton className="h-4 w-24 bg-[hsl(0,0%,12%)]" />
              <Skeleton className="h-4 w-32 bg-[hsl(0,0%,12%)]" />
            </div>
            <Skeleton className="h-10 w-full bg-[hsl(0,0%,12%)]" />
          </div>
        </div>
      )}

      {/* Result card */}
      {clip && !isLoading && (
        <div className="relative z-10 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="rounded-2xl border border-[hsl(264,40%,20%)] bg-[hsl(0,0%,7%)]/80 backdrop-blur-xl overflow-hidden shadow-[0_0_60px_hsl(264,100%,64%,0.08)]">
            {/* Thumbnail */}
            <div className="relative group">
              <img
                src={clip.thumbnailUrl}
                alt={clip.title}
                className="w-full aspect-video object-cover bg-[hsl(0,0%,10%)]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="h-12 w-12 text-white/90" fill="currentColor" />
              </div>
              <span className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-0.5 rounded-md font-mono backdrop-blur-sm">
                {clip.duration}s
              </span>
            </div>

            {/* Info */}
            <div className="p-5 space-y-4">
              <h2 className="text-lg font-semibold leading-snug">{clip.title}</h2>

              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[hsl(0,0%,50%)]">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-[hsl(264,100%,64%)]" />
                  {clip.streamer}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Gamepad2 className="h-3.5 w-3.5 text-[hsl(264,100%,64%)]" />
                  {clip.game}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[hsl(264,100%,64%)]" />
                  {new Date(clip.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>

              {/* Quality selector */}
              <div className="relative">
                <button
                  onClick={() => setQualityOpen(!qualityOpen)}
                  className="w-full flex items-center justify-between h-10 px-4 rounded-xl border border-[hsl(0,0%,16%)] bg-[hsl(0,0%,9%)] text-sm hover:border-[hsl(264,60%,40%)] transition-colors"
                >
                  <span>{clip.qualities[selectedQuality].label}</span>
                  <ChevronDown className={`h-4 w-4 text-[hsl(0,0%,40%)] transition-transform ${qualityOpen ? "rotate-180" : ""}`} />
                </button>
                {qualityOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-[hsl(0,0%,16%)] bg-[hsl(0,0%,9%)] backdrop-blur-xl overflow-hidden shadow-lg">
                    {clip.qualities.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSelectedQuality(i);
                          setQualityOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[hsl(264,100%,64%)]/10 transition-colors ${
                          i === selectedQuality ? "text-[hsl(264,100%,74%)] bg-[hsl(264,100%,64%)]/5" : "text-[hsl(0,0%,70%)]"
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Download button */}
              <Button
                onClick={handleDownload}
                className="w-full h-12 rounded-xl font-semibold text-sm bg-[hsl(264,100%,64%)] hover:bg-[hsl(264,100%,58%)] text-white shadow-[0_0_24px_hsl(264,100%,64%,0.35)] hover:shadow-[0_0_32px_hsl(264,100%,64%,0.5)] transition-all duration-300"
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar Clip
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer hint */}
      <p className="relative z-10 mt-12 text-[10px] text-[hsl(0,0%,25%)] text-center">
        Solo para uso personal. Los clips pertenecen a sus creadores.
      </p>
    </div>
  );
};

export default ClipDownloader;
