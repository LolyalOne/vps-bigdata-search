import { useEffect, useRef, useState } from "react";
import type { ExportProgress } from "@/lib/api-types";
import { exportStatusUrl, USE_MOCK } from "@/lib/api-client";

interface UseExportStreamOpts {
  jobId: string | null;
  totalRows: number;
  format: "xlsx" | "csv" | "zip";
  onDone?: (p: ExportProgress) => void;
}

/**
 * Streams progress. Uses EventSource against the real API and falls back
 * to a deterministic mock ticker when USE_MOCK is on.
 */
export function useExportStream({ jobId, totalRows, format, onDone }: UseExportStreamOpts) {
  const [progress, setProgress] = useState<ExportProgress>({
    pct: 0, rowsProcessed: 0, rowsPerSec: 0,
  });
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!jobId) return;

    setProgress({ pct: 0, rowsProcessed: 0, rowsPerSec: 0 });
    setError(null);
    setReconnecting(false);

    // ---- MOCK MODE ----
    if (USE_MOCK) {
      const startedAt = performance.now();
      const targetMs = Math.min(20_000, Math.max(3_000, totalRows / 4_000));
      const bytesPerRow = format === "zip" ? 55 : format === "csv" ? 140 : 220;
      const timer = window.setInterval(() => {
        const elapsed = performance.now() - startedAt;
        const pct = Math.min(100, (elapsed / targetMs) * 100);
        const rowsProcessed = Math.floor((pct / 100) * totalRows);
        const rowsPerSec = elapsed > 0 ? Math.floor(rowsProcessed / (elapsed / 1000)) : 0;
        const estimatedBytes = totalRows * bytesPerRow;
        const next: ExportProgress = { pct, rowsProcessed, rowsPerSec, estimatedBytes };
        if (pct >= 100) {
          const ext = format === "xlsx" ? "xlsx" : format === "csv" ? "csv" : "zip";
          next.downloadUrl = `#/mock/export-${jobId}.${ext}`;
          setProgress(next);
          onDoneRef.current?.(next);
          window.clearInterval(timer);
        } else {
          setProgress(next);
        }
      }, 250);
      return () => window.clearInterval(timer);
    }

    // ---- REAL MODE (SSE with auto-reconnect) ----
    let es: EventSource | null = null;
    let closed = false;
    let retry = 0;

    const connect = () => {
      es = new EventSource(exportStatusUrl(jobId));
      es.onopen = () => { setReconnecting(false); retry = 0; };
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as ExportProgress;
          setProgress(data);
          if (data.downloadUrl || data.pct >= 100) {
            onDoneRef.current?.(data);
            es?.close();
          }
        } catch {
          /* ignore malformed frame */
        }
      };
      es.onerror = () => {
        if (closed) return;
        es?.close();
        setReconnecting(true);
        retry += 1;
        if (retry > 8) {
          setError("stream_lost");
          return;
        }
        setTimeout(connect, Math.min(8_000, 500 * 2 ** retry));
      };
    };

    connect();
    return () => {
      closed = true;
      es?.close();
    };
  }, [jobId, totalRows, format]);

  return { progress, reconnecting, error };
}
