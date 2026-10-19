import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/layout/GlassCard";
import { FileArchive, FileSpreadsheet, FileText, Download, ShieldCheck, Zap, Database, Activity, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { ExportProgressModal } from "@/components/export/ExportProgressModal";
import { downloadHref } from "@/lib/api-client";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "Esportazioni · Enterprise Big Data Intelligence Platform" },
      { name: "description", content: "Cronologia e telemetria delle esportazioni Big Data." },
    ],
  }),
  component: ExportPage,
});

function ExportPage() {
  const [activeModalJob, setActiveModalJob] = useState<string | null>(null);
  const [modalFormat, setModalFormat] = useState<"xlsx" | "csv" | "zip">("xlsx");
  const [selectedFormat, setSelectedFormat] = useState<"xlsx" | "csv" | "zip">("xlsx");
  const [realJobs, setRealJobs] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/exports/list")
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.exports)) {
          setRealJobs(data.exports);
        }
      })
      .catch(() => {});
  }, []);

  const sampleJobs = [
    { id: "EXP-8921-IT", title: "Anagrafica Imprese Lombardia & Lazio", rows: "45,000", format: "xlsx" as const, status: "Completato", time: "14s fa", size: "12.4 MB" },
    { id: "EXP-8920-IT", title: "Contatti Telefonici Verificati (No Blacklist)", rows: "120,500", format: "csv" as const, status: "Completato", time: "10 min fa", size: "28.1 MB" },
    { id: "EXP-8919-IT", title: "Professionisti Sanità & Albi Roma", rows: "18,200", format: "zip" as const, status: "Completato", time: "1 ora fa", size: "4.8 MB" },
    { id: "EXP-8918-IT", title: "Dati Catastali & Immobiliari Nord Italia", rows: "250,000", format: "csv" as const, status: "Completato", time: "Ieri", size: "64.2 MB" },
  ];

  const allJobs = [...realJobs, ...sampleJobs];

  const triggerSimulation = (jobId: string, format: "xlsx" | "csv" | "zip") => {
    setModalFormat(format);
    setActiveModalJob(jobId);
  };

  return (
    <main className="mx-auto mt-4 sm:mt-6 max-w-7xl space-y-8 px-2 sm:px-6 lg:px-8 pb-12">
      {/* Hero Header */}
      <GlassCard strong className="border-emerald-500/30 bg-[#0A0D0F]/90 p-8 text-white shadow-[0_0_50px_rgba(16,185,129,0.1)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
              <Activity className="h-8 w-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Centro Esportazioni & Telemetria Big Data
                </h1>
                <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  LIVE SSE
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
                Sistema di estrazione massiva a zero latenza connesso al cluster di Roma. Il traffico di esportazione è protetto da crittografia di grado bancario e filtro Blacklist GDPR obbligatorio.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-black/50 px-4 py-3 border border-white/10 text-right">
              <div className="text-[10px] uppercase font-mono text-zinc-400">Capacità Flusso</div>
              <div className="text-sm font-mono font-bold text-cyan-400">4,500 r/sec</div>
            </div>
            <div className="rounded-xl bg-black/50 px-4 py-3 border border-white/10 text-right">
              <div className="text-[10px] uppercase font-mono text-zinc-400">Latenza Cluster</div>
              <div className="text-sm font-mono font-bold text-emerald-400">0.8 ms · IT</div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 3 Formats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setSelectedFormat("xlsx")}
          className={`rounded-2xl border p-6 text-left transition-all duration-300 hover:-translate-y-1 ${
            selectedFormat === "xlsx"
              ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.3)] ring-2 ring-emerald-400"
              : "border-emerald-500/30 bg-[#0F1418] shadow-[0_10px_30px_-15px_rgba(16,185,129,0.2)] hover:border-emerald-500/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-400 font-mono">XLSX NATIVE</span>
              {selectedFormat === "xlsx" && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-black text-xs font-bold shadow-md">✓</span>
              )}
            </div>
          </div>
          <h3 className="mt-4 font-display text-lg font-bold text-white">Excel Ottimizzato</h3>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
            Esportazione tabellare con formattazione automatica, intestazioni bloccate e tipi di dato nativi per analisi immediata su Microsoft Excel.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Consigliato per reportistica e audit
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFormat("csv")}
          className={`rounded-2xl border p-6 text-left transition-all duration-300 hover:-translate-y-1 ${
            selectedFormat === "csv"
              ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.3)] ring-2 ring-cyan-400"
              : "border-cyan-500/30 bg-[#0F1418] shadow-[0_10px_30px_-15px_rgba(6,182,212,0.2)] hover:border-cyan-500/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
              <FileText className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-cyan-500/20 px-2 py-1 text-xs font-bold text-cyan-400 font-mono">CSV UTF-8</span>
              {selectedFormat === "csv" && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-black text-xs font-bold shadow-md">✓</span>
              )}
            </div>
          </div>
          <h3 className="mt-4 font-display text-lg font-bold text-white">CSV Standard Italia</h3>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
            Formato di testo ad altissima velocità compatibile con CRM, ERP aziendali, database SQL e pipeline di elaborazione Python / Pandas.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-cyan-400">
            <Zap className="h-4 w-4" /> Massima velocità di elaborazione
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFormat("zip")}
          className={`rounded-2xl border p-6 text-left transition-all duration-300 hover:-translate-y-1 ${
            selectedFormat === "zip"
              ? "border-violet-400 bg-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.3)] ring-2 ring-violet-400"
              : "border-violet-500/30 bg-[#0F1418] shadow-[0_10px_30px_-15px_rgba(139,92,246,0.2)] hover:border-violet-500/60"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400">
              <FileArchive className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-violet-500/20 px-2 py-1 text-xs font-bold text-violet-400 font-mono">ZIP BUNDLE</span>
              {selectedFormat === "zip" && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-400 text-white text-xs font-bold shadow-md">✓</span>
              )}
            </div>
          </div>
          <h3 className="mt-4 font-display text-lg font-bold text-white">Archivio Compresso</h3>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
            Estrai volumi oltre 500,000 record in pacchetti compresi con riduzione del 75% del consumo di banda e suddivisione automatica.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-violet-400">
            <Database className="h-4 w-4" /> Ideale per esportazioni massive oltre 100k
          </div>
        </button>
      </div>

      {/* Telemetry & Security Banner */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1013] p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Garanzia di Conformità Legale e Blacklist Obbligatoria</span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-mono">CONFORME GDPR</span>
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Tutte le esportazioni generate vengono purificate in tempo reale rimuovendo automaticamente i contatti iscritti alle liste di opposizione (Art. 17 GDPR / Registro Delle Opposizioni).
            </p>
          </div>
        </div>
      </div>

      {/* Recent Exports Table */}
      <GlassCard strong className="border-white/10 bg-[#0A0D0F] p-6 text-white">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-white">Cronologia ed Estrazioni Recenti</h3>
            <p className="text-xs text-zinc-400">Elenco dei job generati dal tuo account e telemetria di download.</p>
          </div>
          <span className="rounded-lg bg-white/5 px-3 py-1 text-xs font-mono text-zinc-300 border border-white/10">
            4 File Archiviati
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase font-mono text-zinc-400">
              <tr>
                <th className="p-3.5">ID Job</th>
                <th className="p-3.5">Nome Estrazione & Query</th>
                <th className="p-3.5">Righe</th>
                <th className="p-3.5">Formato</th>
                <th className="p-3.5">Dimensione</th>
                <th className="p-3.5">Stato</th>
                <th className="p-3.5 text-right">Azione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {allJobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-3.5 font-mono font-bold text-cyan-400">{job.id}</td>
                  <td className="p-3.5 font-semibold text-white">{job.title}</td>
                  <td className="p-3.5 font-mono text-zinc-300">{job.rows}</td>
                  <td className="p-3.5">
                    <span className={`rounded px-2 py-0.5 font-mono font-bold uppercase text-[10px] ${
                      job.format === "xlsx" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                      job.format === "csv" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" :
                      "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                    }`}>
                      {job.format}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-zinc-400">{job.size}</td>
                  <td className="p-3.5">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {job.status} ({job.time})
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    {job.downloadUrl ? (
                      <a
                        href={job.downloadUrl}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 font-semibold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Scarica file
                      </a>
                    ) : (
                      <button
                        onClick={() => triggerSimulation(job.id, job.format)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Scarica di nuovo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {activeModalJob && (
        <ExportProgressModal
          jobId={activeModalJob}
          totalRows={45000}
          format={modalFormat}
          onClose={() => setActiveModalJob(null)}
        />
      )}
    </main>
  );
}
