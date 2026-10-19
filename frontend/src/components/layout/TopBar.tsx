import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Languages, LogOut, User as UserIcon, Palette, Check } from "lucide-react";
import { useT, type Lang } from "@/lib/i18n";
import { useAuth } from "@/context/AuthContext";
import { useTheme, type Theme } from "@/lib/theme";
import { MatchCfModal } from "../match-cf/MatchCfModal";

export function TopBar() {
  const { lang, setLang, t } = useT();
  const { user, logout } = useAuth();
  const { theme, setTheme, THEME_OPTIONS } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const currentThemeOpt = THEME_OPTIONS.find(o => o.id === theme) || THEME_OPTIONS[0];

  return (
    <header className="sticky top-0 z-40 w-full px-2 sm:px-4">
      <div className="glass-strong mx-auto mt-2 sm:mt-4 flex flex-wrap max-w-7xl items-center justify-between gap-2 sm:gap-4 rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3">
        <Link to="/" className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center overflow-hidden rounded-xl bg-black/40 border border-emerald/30 shadow-[0_0_20px_-4px_var(--accent-emerald)] transition-all hover:scale-105">
            <img
              src="/logo.png"
              alt="DataNexus Logo"
              className="h-8 w-8 sm:h-9 sm:w-9 object-contain"
            />
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm sm:text-base font-semibold tracking-tight text-gradient-cyan">
              {t("app.title")}
            </div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground">{t("app.subtitle")}</div>
          </div>
        </Link>

        {user && (
          <nav className="flex items-center gap-1 order-3 w-full justify-center md:order-none md:w-auto mt-2 md:mt-0 border-t border-white/10 pt-2 md:border-0 md:pt-0">
            <NavItem to="/" label={t("nav.dashboard")} />
            <NavItem to="/export" label={t("nav.export")} />
            <button
              type="button"
              onClick={() => setShowMatchModal(true)}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold text-emerald transition-colors hover:bg-emerald/10 border border-emerald/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] ml-2 flex items-center gap-1"
            >
              {t("nav.match")}
            </button>
          </nav>
        )}

        <div className="flex items-center gap-2 sm:gap-3 ml-auto md:ml-0">
          {user && (
            <div className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-emerald/40 bg-emerald/10 px-2.5 sm:px-3 py-1 text-xs text-emerald font-medium shadow-[0_0_15px_-4px_var(--accent-emerald)]">
              <UserIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[90px] sm:max-w-[160px] truncate">{user.email || 'Utente Executive'}</span>
              <button
                type="button"
                onClick={logout}
                title={lang === "it" ? "Esci" : "Sair"}
                className="ml-0.5 rounded-full p-1 hover:bg-emerald/20 hover:text-white transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all hover:border-emerald/40 hover:bg-white/5"
              title="Cambia Tema UI (Awesome Design MD)"
            >
              <Palette className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald" />
              <span className="hidden sm:inline font-mono" style={{ color: currentThemeOpt.color }}>{currentThemeOpt.badge}</span>
              <span
                className="h-2.5 w-2.5 rounded-full inline-block sm:hidden"
                style={{ backgroundColor: currentThemeOpt.color, boxShadow: `0 0 8px ${currentThemeOpt.color}` }}
              />
            </button>

            {showThemeMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
                <div className="glass-strong absolute right-0 mt-2 z-50 w-52 sm:w-56 rounded-2xl border border-white/10 bg-[#0c0e12]/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-white/5 mb-1">
                    🎨 Design Themes (awesome-md)
                  </div>
                  <div className="max-h-[300px] overflow-y-auto space-y-0.5 pr-0.5">
                    {THEME_OPTIONS.map((opt) => {
                      const active = opt.id === theme;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setTheme(opt.id);
                            setShowThemeMenu(false);
                          }}
                          className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium transition-all ${
                            active ? "bg-white/10 text-white font-bold shadow-sm" : "text-muted-foreground hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: opt.color, boxShadow: active ? `0 0 10px ${opt.color}` : "none" }}
                            />
                            <span className="truncate">{opt.name}</span>
                          </div>
                          {active && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: opt.color }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="glass flex items-center gap-1 rounded-full px-2 py-1">
            <Languages className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            <LangBtn current={lang} value="it" onClick={setLang} label="IT" />
            <LangBtn current={lang} value="pt" onClick={setLang} label="PT" />
          </div>
        </div>
      </div>
      {showMatchModal && <MatchCfModal onClose={() => setShowMatchModal(false)} />}
    </header>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
      activeProps={{ className: "text-foreground bg-white/5 font-medium" }}
    >
      {label}
    </Link>
  );
}

function LangBtn({
  current, value, onClick, label,
}: { current: Lang; value: Lang; onClick: (l: Lang) => void; label: string }) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={
        "rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all " +
        (active
          ? "bg-emerald text-background shadow-[0_0_20px_-4px_var(--accent-emerald)]"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </button>
  );
}
