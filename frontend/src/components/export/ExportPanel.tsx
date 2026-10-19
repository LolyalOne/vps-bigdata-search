import { useState } from "react";
import { FileSpreadsheet, FileText, FileArchive, Download } from "lucide-react";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ExportFormat, SearchFilters } from "@/lib/api-types";
import { startExport } from "@/lib/api-client";
import { ExportProgressModal } from "./ExportProgressModal";

interface Props {
  filters: SearchFilters;
  totalRows: number;
  disabled?: boolean;
}

export function ExportPanel({ filters, totalRows, disabled }: Props) {
  const { t } = useT();
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [exportName, setExportName] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const start = async (overrideFormat?: ExportFormat) => {
    setStarting(true);
    setErrorMsg(null);
    try {
      const { jobId } = await startExport(filters, overrideFormat || format, exportName);
      setJobId(jobId);
    } catch (e: any) {
      if (e.message?.includes("LIMITE_EXCEL|")) {
         setErrorMsg("LIMITE_EXCEL");
      } else {
         setErrorMsg(e.message || "Erro durante l'esportazione");
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <GlassCard strong>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-gradient-cyan">{t("export.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("export.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <FormatCard
          active={format === "xlsx"}
          onClick={() => setFormat("xlsx")}
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title={t("export.xlsx.title")}
          desc={t("export.xlsx.desc")}
          accent="emerald"
        />
        <FormatCard
          active={format === "csv"}
          onClick={() => setFormat("csv")}
          icon={<FileText className="h-5 w-5" />}
          title={t("export.csv.title")}
          desc={t("export.csv.desc")}
          accent="cyan"
        />
        <FormatCard
          active={format === "zip"}
          onClick={() => setFormat("zip")}
          icon={<FileArchive className="h-5 w-5" />}
          title={t("export.zip.title")}
          desc={t("export.zip.desc")}
          accent="violet"
        />
      </div>

      <div className="mt-4">
        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
          {t("export.customName.label" as any) || "Nome di Riferimento Esportazione (Opzionale)"}
        </label>
        <input
          type="text"
          value={exportName}
          onChange={(e) => setExportName(e.target.value)}
          placeholder={t("export.customName.placeholder" as any) || "Es. contatos_lombardia_2026..."}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono"
        />
      </div>

      {format === "xlsx" && totalRows > 1000000 && (
        <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
          <p className="text-sm font-bold text-amber-400 mb-2">
            ⚠️ Aviso de Performance: Arquivo Excel Gigante
          </p>
          <p className="text-xs text-zinc-300 mb-3">
            O volume de dados excede 1 milhão de registros. O arquivo único será gerado com múltiplas abas (100 mil linhas cada) para não corromper.
            <br/>
            <strong>Atenção:</strong> Pode ser muito demorado abrir este arquivo no Excel local. Escolha abaixo como prefere gerar:
          </p>
          <div className="flex flex-wrap gap-3">
             <Button onClick={() => start("xlsx")} className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-9">
                Forçar Arquivo Único (Excel Gigante)
             </Button>
             <Button onClick={() => start("xlsx_split")} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9">
                Dividir em Múltiplos Arquivos (Recomendado)
             </Button>
          </div>
        </div>
      )}
      
      {errorMsg && errorMsg !== "LIMITE_EXCEL" && (
        <div className="mt-4 text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
          {errorMsg}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {new Intl.NumberFormat("it-IT").format(totalRows)} {t("results.rows")}
        </div>
        <Button
          onClick={() => start()}
          disabled={disabled || starting || totalRows === 0 || (format === "xlsx" && totalRows > 1000000)}
          className="h-11 rounded-xl bg-violet px-5 font-semibold text-background shadow-[0_10px_30px_-10px_var(--accent-violet)] hover:brightness-110"
        >
          <Download className="mr-2 h-4 w-4" />
          {t("export.start")}
        </Button>
      </div>

      {jobId && (
        <ExportProgressModal
          jobId={jobId}
          totalRows={totalRows}
          format={format}
          onClose={() => setJobId(null)}
        />
      )}
    </GlassCard>
  );
}

function FormatCard({
  active, onClick, icon, title, desc, accent,
}: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; title: string; desc: string;
  accent: "cyan" | "emerald" | "violet";
}) {
  const activeStyle =
    accent === "cyan" ? "bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)]" :
    accent === "emerald" ? "bg-emerald-500/20 border-2 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]" :
    "bg-violet-500/20 border-2 border-violet-400 shadow-[0_0_30px_rgba(139,92,246,0.3)]";
  const inactiveStyle = "bg-[#0F1418]/60 border border-white/10 hover:border-white/20 hover:bg-[#0F1418]";
  const iconColor = accent === "cyan" ? "text-cyan-400 bg-cyan-500/20" : accent === "emerald" ? "text-emerald-400 bg-emerald-500/20" : "text-violet-400 bg-violet-500/20";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-2.5 rounded-xl p-4 text-left transition-all duration-300",
        "hover:-translate-y-1",
        active ? activeStyle : inactiveStyle,
      )}
    >
      <div className="flex w-full items-center justify-between">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          iconColor,
        )}>
          {icon}
        </div>
        {active && (
          <span className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-md",
            accent === "cyan" ? "bg-cyan-400 text-black" : accent === "emerald" ? "bg-emerald-400 text-black" : "bg-violet-400 text-white"
          )}>
            ✓
          </span>
        )}
      </div>
      <div className={cn("text-sm font-bold", active ? "text-white" : "text-zinc-300")}>{title}</div>
      <div className="text-xs leading-relaxed text-zinc-400">{desc}</div>
    </button>
  );
}
