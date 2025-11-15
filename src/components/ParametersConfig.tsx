import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Settings2 } from "lucide-react";

interface ParametersConfigProps {
  messageThreshold: number;
  setMessageThreshold: (value: number) => void;
  clipDuration: number;
  setClipDuration: (value: number) => void;
  sensitivity: number;
  setSensitivity: (value: number) => void;
}

const ParametersConfig = ({
  messageThreshold,
  setMessageThreshold,
  clipDuration,
  setClipDuration,
  sensitivity,
  setSensitivity,
}: ParametersConfigProps) => {
  return (
    <Card className="p-6 bg-card border-border shadow-card">
      <div className="flex items-center gap-2 mb-6">
        <Settings2 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Configuración de Detección</h3>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label htmlFor="threshold" className="text-sm font-medium text-foreground">
              Umbral de Mensajes/Segundo
            </Label>
            <span className="text-sm font-bold text-primary">{messageThreshold} msg/s</span>
          </div>
          <Slider
            id="threshold"
            min={20}
            max={200}
            step={5}
            value={[messageThreshold]}
            onValueChange={(value) => setMessageThreshold(value[0])}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Se generará un clip cuando los mensajes superen este umbral
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label htmlFor="duration" className="text-sm font-medium text-foreground">
              Duración del Clip
            </Label>
            <span className="text-sm font-bold text-primary">{clipDuration}s</span>
          </div>
          <Slider
            id="duration"
            min={10}
            max={60}
            step={5}
            value={[clipDuration]}
            onValueChange={(value) => setClipDuration(value[0])}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Duración de cada clip generado
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label htmlFor="sensitivity" className="text-sm font-medium text-foreground">
              Sensibilidad
            </Label>
            <span className="text-sm font-bold text-primary">
              {sensitivity === 1 ? "Baja" : sensitivity === 2 ? "Media" : "Alta"}
            </span>
          </div>
          <Slider
            id="sensitivity"
            min={1}
            max={3}
            step={1}
            value={[sensitivity]}
            onValueChange={(value) => setSensitivity(value[0])}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Sensibilidad para detectar picos de actividad
          </p>
        </div>
      </div>
    </Card>
  );
};

export default ParametersConfig;
