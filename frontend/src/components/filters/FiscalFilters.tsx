import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  cf: string; pi: string; hasAzienda: boolean;
  onCf: (v: string) => void; onPi: (v: string) => void; onHasAzienda: (v: boolean) => void;
}

export function FiscalFilters({ cf, pi, hasAzienda, onCf, onPi, onHasAzienda }: Props) {
  const { t } = useT();
  const cfValid = cf.length === 0 || cf.length === 16;
  const piValid = pi.length === 0 || pi.length === 11;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            {t("fiscal.cf")}
          </Label>
          <Input
            value={cf}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
              onCf(v);
            }}
            maxLength={16}
            placeholder="RSSMRA80A01H501U"
            className={cn(
              "glass h-10 border-white/10 font-mono uppercase tracking-wider",
              !cfValid && "border-destructive/50",
            )}
          />
          <div className="mt-1 text-[11px] text-muted-foreground/80">{cf.length}/16</div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
            {t("fiscal.pi")}
          </Label>
          <Input
            value={pi}
            onChange={(e) => onPi(e.target.value.replace(/\D/g, "").slice(0, 11))}
            inputMode="numeric"
            maxLength={11}
            placeholder="12345678901"
            className={cn(
              "glass h-10 border-white/10 font-mono tracking-wider",
              !piValid && "border-destructive/50",
            )}
          />
          <div className="mt-1 text-[11px] text-muted-foreground/80">{pi.length}/11</div>
        </div>
      </div>
      
      <div className="flex items-center pt-2">
        <label className="flex cursor-pointer items-center gap-2">
          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded border border-white/20 transition-colors",
              hasAzienda ? "bg-cyan-500 border-cyan-500 text-black" : "bg-black/20 text-transparent"
            )}
            onClick={() => onHasAzienda(!hasAzienda)}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 stroke-current stroke-[3px]" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className="text-sm text-zinc-300 select-none" onClick={() => onHasAzienda(!hasAzienda)}>
            Filtra solo persone con impresa associata (P.IVA)
          </span>
        </label>
      </div>
    </div>
  );
}
