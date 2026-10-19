import { ChevronLeft, ChevronRight, Clock, Rows, Inbox } from "lucide-react";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import type { SearchFilters, SearchResult } from "@/lib/api-types";
import { cn } from "@/lib/utils";

interface Props {
  result?: SearchResult;
  filters: SearchFilters;
  loading: boolean;
  error: unknown;
  awaiting: boolean;   // true = never searched yet
  onPage: (p: number) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("it-IT").format(n);
}

export function ResultsTable({ result, filters, loading, error, awaiting, onPage }: Props) {
  const { t } = useT();

  const totalPages = result ? Math.max(1, Math.ceil(result.total / filters.pageSize)) : 1;

  return (
    <GlassCard strong className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 p-4">
        <div className="flex items-center gap-4 text-sm">
          <h3 className="font-display text-lg font-semibold">{t("results.title")}</h3>
          {result && (
            <>
              <Stat icon={<Rows className="h-3.5 w-3.5" />} value={`${fmt(result.total)} ${t("results.rows")}`} />
              <Stat icon={<Clock className="h-3.5 w-3.5" />} value={`${t("results.elapsed")} ${result.elapsedMs} ms`} />
            </>
          )}
        </div>
        {result && result.total > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Button variant="ghost" size="sm" disabled={filters.page <= 1 || loading}
              onClick={() => onPage(filters.page - 1)}>
              <ChevronLeft className="h-4 w-4" /> {t("results.prev")}
            </Button>
            <span className="font-mono text-muted-foreground">
              {t("results.page")} {filters.page} {t("results.of")} {fmt(totalPages)}
            </span>
            <Button variant="ghost" size="sm" disabled={filters.page >= totalPages || loading}
              onClick={() => onPage(filters.page + 1)}>
              {t("results.next")} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="relative min-h-[280px] overflow-auto">
        {loading && <SkeletonRows global={filters.table === "global"} />}
        {!loading && Boolean(error) && (
          <EmptyState icon={<Inbox className="h-5 w-5 text-destructive" />} text={error instanceof Error ? error.message : t("error.generic")} />
        )}
        {!loading && !error && awaiting && (
          <EmptyState icon={<Inbox className="h-5 w-5 text-muted-foreground" />} text={t("results.awaiting")} />
        )}
        {!loading && !error && !awaiting && result && result.rows.length === 0 && (
          <EmptyState icon={<Inbox className="h-5 w-5 text-muted-foreground" />} text={t("results.empty")} />
        )}

        {!loading && !error && result && result.rows.length > 0 && (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-black/40 backdrop-blur">
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {result.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-4 py-3 font-semibold">{c.replace(/_/g, " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className={cn(
                  "border-t border-white/5 transition-colors hover:bg-white/[0.03]",
                )}>
                  {result.columns.map((c) => {
                    const v = row[c];
                    return (
                      <td key={c} className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px] text-foreground/90">
                        {v === null || v === undefined || v === ""
                          ? <span className="text-muted-foreground/40">—</span>
                          : String(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </GlassCard>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs text-muted-foreground">
      {icon}<span className="font-mono">{value}</span>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="glass flex h-10 w-10 items-center justify-center rounded-full">{icon}</div>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function SkeletonRows({ global }: { global: boolean }) {
  const { t } = useT();
  return (
    <div className="space-y-3 p-4">
      <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
        <FuturisticSpinner />
        <span>{global ? t("loading.global") : t("loading.table")}</span>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-9 rounded-lg" />
      ))}
    </div>
  );
}

function FuturisticSpinner() {
  return (
    <div className="relative h-5 w-5">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, transparent 0deg, var(--accent-cyan) 180deg, transparent 360deg)",
          animation: "spin-slow 1s linear infinite",
          mask: "radial-gradient(closest-side, transparent 60%, black 62%)",
          WebkitMask: "radial-gradient(closest-side, transparent 60%, black 62%)",
        }}
      />
    </div>
  );
}
