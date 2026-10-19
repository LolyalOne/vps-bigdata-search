import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SearchMode } from "@/lib/api-types";

interface Props {
  q: string;
  mode: SearchMode;
  onQ: (v: string) => void;
  onMode: (m: SearchMode) => void;
}

export function SearchBox({ q, mode, onQ, onMode }: Props) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder={t("text.placeholder")}
          className="glass h-11 border-white/10 pl-9 text-base placeholder:text-muted-foreground/70"
        />
      </div>
      <div className="glass inline-flex items-center rounded-full p-1 text-xs">
        <Segment active={mode === "exact"} onClick={() => onMode("exact")}>
          {t("mode.exact")}
        </Segment>
        <Segment active={mode === "fuzzy"} onClick={() => onMode("fuzzy")} accent>
          <Sparkles className="mr-1 h-3 w-3" />
          {t("mode.fuzzy")}
        </Segment>
      </div>
    </div>
  );
}

function Segment({
  active, onClick, accent, children,
}: { active: boolean; onClick: () => void; accent?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 font-medium transition-all",
        active
          ? accent
            ? "bg-violet text-background shadow-[0_0_20px_-4px_var(--accent-violet)]"
            : "bg-cyan text-background shadow-[0_0_20px_-4px_var(--accent-cyan)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
