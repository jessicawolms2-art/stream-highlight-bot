import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UrlInputProps {
  onAnalyze: (url: string) => void;
  isAnalyzing: boolean;
}

const UrlInput = ({ onAnalyze, isAnalyzing }: UrlInputProps) => {
  const [url, setUrl] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "URL requerida",
        description: "Por favor ingresa un link de Twitch o Kick",
        variant: "destructive",
      });
      return;
    }

    if (!url.includes("twitch.tv") && !url.includes("kick.com")) {
      toast({
        title: "URL no válida",
        description: "Solo se aceptan links de Twitch o Kick",
        variant: "destructive",
      });
      return;
    }

    onAnalyze(url);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Pega aquí el link del VOD o stream de Twitch/Kick..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isAnalyzing}
            className="pl-12 h-14 text-lg bg-card border-border focus:border-primary transition-colors"
          />
        </div>
        <Button
          type="submit"
          disabled={isAnalyzing}
          className="h-14 px-8 bg-gradient-primary text-primary-foreground hover:opacity-90 transition-opacity font-semibold"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Analizando
            </>
          ) : (
            "Analizar"
          )}
        </Button>
      </div>
    </form>
  );
};

export default UrlInput;
