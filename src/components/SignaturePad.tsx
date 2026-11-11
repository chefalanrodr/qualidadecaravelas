import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  height?: number;
};

export function SignaturePad({ value, onChange, label, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(!value);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";

    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
      setEmpty(false);
    }
  }, [value]);

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setEmpty(false);
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const c = canvasRef.current!;
    onChange(c.toDataURL("image/png"));
  }

  function clear() {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-semibold">{label}</label>}
      <div className="relative rounded-lg border-2 border-dashed border-border bg-background overflow-hidden" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            Assine aqui
          </div>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-8 text-xs">
        <Eraser className="w-3.5 h-3.5 mr-1" /> Limpar
      </Button>
    </div>
  );
}
