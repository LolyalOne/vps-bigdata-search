import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useExportStream } from "@/hooks/useSSE";
import { downloadHref, USE_MOCK } from "@/lib/api-client";
import type { ExportFormat, ExportProgress } from "@/lib/api-types";

interface Props {
  jobId: string;
  totalRows: number;
  format: ExportFormat;
  onClose: () => void;
}

function fmt(n: number) { return new Intl.NumberFormat("it-IT").format(n); }
function fmtBytes(b?: number) {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}
function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ExportProgressModal({ jobId, totalRows, format, onClose }: Props) {
  const { t } = useT();
  const [done, setDone] = useState<ExportProgress | null>(null);
  const [startedAt] = useState(() => performance.now());
  const [elapsed, setElapsed] = useState(0);

  const { progress, reconnecting, error } = useExportStream({
    jobId, totalRows, format, onDone: (p) => setDone(p),
  });

  useEffect(() => {
    const t = window.setInterval(() => setElapsed(performance.now() - startedAt), 250);
    return () => window.clearInterval(t);
  }, [startedAt]);

  const p = done ?? progress;
  const finished = !!done?.downloadUrl;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg border border-emerald-500/40 bg-[#0A0E11] p-0 text-white shadow-[0_0_60px_rgba(16,185,129,0.25)] backdrop-blur-2xl">
        <div className="relative p-6">
          <DialogTitle className="font-display text-xl font-bold text-emerald-400">
            {finished ? "Esportazione Big Data Completata" : "Estrazione e Formattazione in Corso..."}
          </DialogTitle>
          <div className="mt-1 text-xs font-mono text-zinc-400">
            Job ID: <span className="text-emerald-300">{jobId}</span> · Formato: <span className="uppercase font-bold text-cyan-400">{format}</span>
          </div>

          {/* Progress ring + stats */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 rounded-xl border border-white/10 bg-black/40 p-4">
            <ProgressRing pct={p.pct} />
            <div className="grid flex-1 w-full gap-2 text-sm">
              <Row label="Righe Elaborate:" value={`${fmt(p.rowsProcessed)} / ${fmt(totalRows)}`} />
              <Row label="Velocità di Flusso:" value={`${fmt(p.rowsPerSec)} r/s`} />
              <Row label="Tempo Trascorso:" value={fmtElapsed(elapsed)} />
              <Row label="Dimensione Stimata:" value={fmtBytes(p.estimatedBytes)} />
            </div>
          </div>

          {/* Bar */}
          <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-white/10 border border-white/5">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${p.pct}%`,
                background: "linear-gradient(90deg, #10B981, #06B6D4)",
                boxShadow: "0 0 24px -2px #10B981",
              }}
            />
          </div>

          {reconnecting && (
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connessione al flusso dati SSE in corso...
            </div>
          )}
          {error && (
            <div className="mt-4 text-xs font-semibold text-rose-400">Errore durante la trasmissione dei dati. Riprova.</div>
          )}

          {finished && done?.downloadUrl && (
            <div className="mt-6">
              <a
                href={USE_MOCK ? "#" : downloadHref(done.downloadUrl.split("/").pop() ?? "")}
                onClick={(e) => USE_MOCK && e.preventDefault()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-3.5 font-bold text-white shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:brightness-110 transition-all"
              >
                <Download className="h-5 w-5" />
                Scarica File {format.toUpperCase()} ({fmtBytes(p.estimatedBytes)})
              </a>
            </div>
          )}

          {!finished && (
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
                <X className="mr-1 h-4 w-4" /> Chiudi e lascia in background
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-1 text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono font-semibold text-white">{value}</span>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke="url(#ring-g)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset .3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono text-lg font-bold text-white">
        {Math.round(pct)}%
      </div>
    </div>
  );
}
