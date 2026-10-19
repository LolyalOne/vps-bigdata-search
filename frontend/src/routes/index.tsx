import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Search, SlidersHorizontal, ShieldCheck, ShieldAlert, Download, Database, ChevronDown, ChevronUp, MapPin, HelpCircle, Users, Building2, Phone, Copy } from "lucide-react";

import { GlassCard } from "@/components/layout/GlassCard";
import { SearchBox } from "@/components/filters/SearchBox";
import { FiscalFilters } from "@/components/filters/FiscalFilters";
import { GeoFilters } from "@/components/filters/GeoFilters";
import { ContactFilters } from "@/components/filters/ContactFilters";
import { ContactSuppressionUpload } from "@/components/filters/ContactSuppressionUpload";
import { ResultsTable } from "@/components/results/ResultsTable";
import { ExportPanel } from "@/components/export/ExportPanel";
import { BlacklistManagerModal } from "@/components/blacklist/BlacklistManagerModal";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { search, fetchComuneSummary } from "@/lib/api-client";
import type { SearchFilters, SearchResult } from "@/lib/api-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ricerca · Enterprise Big Data Intelligence Platform" },
      { name: "description", content: "Motore di ricerca su 11 basi dati italiane con filtri fiscali, geografici e conformità GDPR." },
    ],
  }),
  component: Dashboard,
});

const DEFAULT_FILTERS: SearchFilters = {
  table: "global",
  target: "all",
  channel: "all",
  ageMin: undefined,
  ageMax: undefined,
  sesso: "",
  categoria: "",
  q: "",
  mode: "exact",
  cf: "",
  pi: "",
  comune: "",
  provincia: "",
  regione: "",
  cap: "",
  require: { fixed: false, mobile: false, email: false },
  blacklist: true,
  onlyItalians: false,
  page: 1,
  pageSize: 100,
};

const TABLES_MINI = [
  { id: "global", label: "Anagrafica Globale", rows: "34.2M" },
  { id: "privati_2023", label: "Privati Cittadini 2023", rows: "14.5M" },
  { id: "aziende_2023", label: "Aziende & Imprese 2023", rows: "3.8M" },
  { id: "nord_totale", label: "Macroregione Nord", rows: "6.2M" },
  { id: "censud_totale", label: "Centro-Sud Totale", rows: "4.9M" },
];

function Dashboard() {
  const { t } = useT();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [result, setResult] = useState<SearchResult | undefined>(undefined);
  const [awaiting, setAwaiting] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const searchMut = useMutation({
    mutationFn: (f: SearchFilters) => search(f),
    onSuccess: (r) => { setResult(r); setAwaiting(false); },
    onError: () => setAwaiting(false),
  });

  const patch = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v, page: k === "page" ? (v as number) : 1 }));

  const run = () => {
    if (filters.table === "global") {
      const hasQ = !!filters.q?.trim();
      const hasRegione = !!filters.regione?.trim();
      const hasProvincia = !!filters.provincia?.trim();
      const hasComune = !!filters.comune?.trim();
      const hasCategoria = !!filters.categoria?.trim();
      const hasSesso = !!filters.sesso?.trim();
      const hasCf = !!filters.cf?.trim();
      const hasPi = !!filters.pi?.trim();
      const hasCap = !!filters.cap?.trim();
      const hasAgeMin = filters.ageMin !== undefined && filters.ageMin !== null;
      const hasAgeMax = filters.ageMax !== undefined && filters.ageMax !== null;
      const hasFixed = !!filters.require?.fixed;
      const hasMobile = !!filters.require?.mobile;
      const hasEmail = !!filters.require?.email;

      if (
        !hasQ &&
        !hasRegione &&
        !hasProvincia &&
        !hasComune &&
        !hasCategoria &&
        !hasSesso &&
        !hasCf &&
        !hasPi &&
        !hasCap &&
        !hasAgeMin &&
        !hasAgeMax &&
        !hasFixed &&
        !hasMobile &&
        !hasEmail
      ) {
        alert("Por segurança e performance, forneça pelo menos um filtro de pesquisa.");
        return;
      }
    }
    searchMut.mutate({ ...filters, page: 1 });
  };
  const goPage = (p: number) => {
    const next = { ...filters, page: p };
    setFilters(next);
    searchMut.mutate(next);
  };
  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setResult(undefined);
    setAwaiting(true);
    setShowFilters(false);
    setShowExport(false);
  };

  const copyFiltersForClient = () => {
    const f = filters;
    const lines = ["📋 RIEPILOGO FILTRI DI RICERCA"];
    lines.push("---------------------------------");
    
    if (f.target) {
      const tgMap: Record<string, string> = { all: "Tutti", privati: "Persone Fisiche", aziende: "Aziende", professionisti: "Professionisti", villette: "Villette & Villas", catasto: "Catasto (Nord)" };
      lines.push(`Target: ${tgMap[f.target] || f.target}`);
    }
    if (f.channel && f.channel !== "all") {
      const chMap: Record<string, string> = { email: "Solo Email", mobile: "Solo Cellulari", fixed: "Solo Telefoni Fissi" };
      lines.push(`Canale di Contatto: ${chMap[f.channel] || f.channel}`);
    }
    
    const geo = [];
    if (f.macrorregione) geo.push(`Macro: ${f.macrorregione}`);
    if (f.regione) geo.push(`Regioni: ${f.regione}`);
    if (f.provincia) geo.push(`Province: ${f.provincia}`);
    if (f.comune) geo.push(`Comuni: ${f.comune}`);
    if (f.cap) geo.push(`CAP: ${f.cap}`);
    if (geo.length) lines.push(`Localizzazione: ${geo.join(" | ")}`);
    
    if (f.ageMin || f.ageMax) lines.push(`Età: Da ${f.ageMin || 18} a ${f.ageMax || 100} anni`);
    if (f.sesso) lines.push(`Sesso: ${f.sesso === 'M' ? 'Uomini' : 'Donne'}`);
    
    if (f.q) lines.push(`Ricerca Libera: "${f.q}"`);
    
    if (f.require?.mobile ? f.onlyItalians : false) {
      lines.push(`Nazionalità: Solo Italiani`);
    } else if (f.origineEtnica && f.origineEtnica !== "TUTTI") {
      lines.push(`Origine Etnica: ${f.origineEtnica}`);
    }

    if (f.categoria) lines.push(`Settore/Categoria: ${f.categoria}`);
    
    if (f.strictNameFilter) lines.push(`Filtro Speciale: Filtro Estretto Nome Attivo (Esclude stranieri)`);
    if (f.isVillette) lines.push(`Filtro Speciale: Villette & Villas`);

    const txt = lines.join("\n");
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(() => {
        alert("Filtri copiati negli appunti!");
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = txt;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert("Filtri copiati negli appunti!");
      } catch (err) {
        alert("Errore durante la copia dei filtri.");
      }
      textArea.remove();
    }
  };

  return (
    <main className="mx-auto mt-4 sm:mt-6 max-w-7xl space-y-6 px-2 sm:px-6 lg:px-8 pb-16">
      {/* GUIDA & SPIEGAZIONE STRUMENTI */}
      {showGuide && (
        <GlassCard className="border-cyan-500/30 bg-[#0F1418]/95 p-6 text-white shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 border-l-4 border-l-cyan-400">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-cyan-400 flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              <span>Guida Operativa: Uso dei Database & Strumenti della Piattaforma</span>
            </h3>
            <button
              onClick={() => setShowGuide(false)}
              className="text-zinc-400 hover:text-white text-xs underline font-semibold transition-colors"
            >
              Chiudi Guida
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 text-xs text-zinc-300 leading-relaxed">
            <div className="space-y-2 rounded-xl bg-white/5 p-4 border border-white/5">
              <h4 className="font-bold text-white flex items-center gap-1.5 text-sm text-emerald-400">
                <Database className="h-4 w-4" /> 1. I 5 Database Dati Disponibili
              </h4>
              <p><strong>Anagrafica Globale (34.2M):</strong> Catalogo nazionale completo di tutte le imprese, partite IVA e società italiane.</p>
              <p><strong>Privati Cittadini 2023 (14.5M):</strong> Registro delle persone fisiche, contatti residenziali e utenze sul territorio.</p>
              <p><strong>Aziende & Imprese 2023 (3.8M):</strong> Indice B2B camerali con ragione sociale e codici fiscali operativi.</p>
              <p><strong>Macroregione Nord & Centro-Sud:</strong> Sotto-insiemi territoriali pre-filtrati per campagne ad elevata velocità.</p>
            </div>
            <div className="space-y-2 rounded-xl bg-white/5 p-4 border border-white/5">
              <h4 className="font-bold text-white flex items-center gap-1.5 text-sm text-cyan-400">
                <MapPin className="h-4 w-4" /> 2. Metodo Principale: Filtro Geografico
              </h4>
              <p>Il nostro motore privilegia la ricerca territoriale. Seleziona una <strong>Macrorregione</strong> (es. Nord Italia), una singola <strong>Regione</strong> o <strong>Provincia</strong>, oppure digita il <strong>Comune o CAP</strong>.</p>
              <p>Il sistema estrapola istantaneamente i record che appartengono all'area scelta, fungendo da metodo di ricerca predefinito senza bisogno di digitare testo.</p>
            </div>
            <div className="space-y-2 rounded-xl bg-white/5 p-4 border border-white/5">
              <h4 className="font-bold text-white flex items-center gap-1.5 text-sm text-blue-400">
                <Search className="h-4 w-4" /> 3. Ricerca Specifica & Filtri Avanzati
              </h4>
              <p>Usa la barra di ricerca testuale (opzionale) solo se desideri filtrare per una specifica <strong>Ragione Sociale, Nome o Cognome</strong>.</p>
              <p>Apri i <strong>Filtri Avanzati</strong> per affinare ulteriormente la ricerca tramite Codice Fiscale, Partita IVA, oppure per esigere la presenza di Telefono Fisso, Mobile o Email validati.</p>
            </div>
            <div className="space-y-2 rounded-xl bg-white/5 p-4 border border-white/5">
              <h4 className="font-bold text-white flex items-center gap-1.5 text-sm text-purple-400">
                <ShieldCheck className="h-4 w-4" /> 4. Conformità GDPR & Esportazione
              </h4>
              <p><strong>Blacklist Obbligatoria:</strong> Tutti i dati vengono filtrati in tempo reale secondo l'Art. 17 del GDPR e il Registro Pubblico delle Opposizioni.</p>
              <p><strong>Esportazione Dati:</strong> Clicca su "Pannello Esportazione Big Data" per scaricare i risultati in formato standard CSV o Archivio ZIP compresso per CRM e call center.</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* MINIMALIST HERO SEARCH SPOTLIGHT */}
      <GlassCard strong className="border-emerald-500/30 bg-[#0A0D0F]/95 p-6 md:p-8 text-white shadow-[0_0_50px_rgba(16,185,129,0.12)]">
        {/* SECTION 1: SELEZIONE PUBBLICO & CANALE (MOTORE UNIFICATO INTEGRATO) */}
        <div className="pb-6 border-b border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
                <Database className="h-4 w-4" />
              </div>
              <span>1. Pubblico Target & Canale di Contatto (Motore Unificato Integrato)</span>
            </h3>
            <div className="flex items-center gap-2">
              <a
                href="#anti-duplicidade"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-extrabold text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-black transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                {t("suppression.shortcut")}
              </a>
              <span className="text-xs font-mono text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Ricerca Intelligente
              </span>
            </div>
          </div>

          {/* Pubblico Target Pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 font-mono uppercase">
              <Users className="h-3.5 w-3.5 text-cyan-400" /> Pubblico Target:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "all", label: "🌐 Tutti / Global", desc: "34.2M Record" },
                { id: "privati", label: "👤 Persone Fisiche / Privati", desc: "14.5M+ Residenti" },
                { id: "aziende", label: "🏢 Aziende & Imprese", desc: "3.8M+ B2B" },
                { id: "villette", label: "🏡 Villette & Villas", desc: "6.0M+ Residenziale" },
              ].map((item) => {
                const active = (filters.target || "all") === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { patch("target", item.id); patch("isVillette", item.id === "villette"); }}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                      active
                        ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.25)] scale-[1.02]"
                        : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-transparent"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${active ? "bg-emerald-500/30 text-white font-bold" : "bg-black/40 text-zinc-500"}`}>
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canale di Contatto Pills */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 font-mono uppercase">
              <Phone className="h-3.5 w-3.5 text-emerald-400" /> Canale di Contatto Desiderato:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "all", label: "⚡ Qualsiasi Canale" },
                { id: "email", label: "✉️ E-mail Consensuate" },
                { id: "mobile", label: "📱 Cellulari Verificati" },
                { id: "fixed", label: "☎️ Telefoni Fissi" },
              ].map((item) => {
                const active = (filters.channel || "all") === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => patch("channel", item.id)}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                        : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-transparent"
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 2: FILTRI DEMOGRAFICI & SETTORIALI DINAMICI */}
        <div className="py-6 border-b border-white/10 space-y-4">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/30 shadow-sm">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <span>2. Filtri Demografici & Settoriali (Attivazione Dinamica)</span>
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Box Persone Fisiche */}
            <div className={`rounded-2xl p-4 border transition-all ${
              (filters.target || "all") === "aziende"
                ? "bg-black/30 border-white/5 opacity-40 pointer-events-none"
                : "bg-white/5 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-xs text-emerald-400 uppercase font-mono flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Persone Fisiche (Età & Sesso)
                </span>
                {(filters.target || "all") === "aziende" && (
                  <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-mono font-bold">
                    🔒 Solo per Privati
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Sesso (Genere):</label>
                  <div className="flex gap-2">
                    {[
                      { id: "", label: "Tutti" },
                      { id: "M", label: "👨 Maschi (M)" },
                      { id: "F", label: "👩 Femmine (F)" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => patch("sesso", s.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          (filters.sesso || "") === s.id
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-black/40 text-zinc-400 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Età Minima (Anni):</label>
                    <input
                      type="number"
                      placeholder="Es. 30"
                      min={18}
                      max={100}
                      value={filters.ageMin || ""}
                      onChange={(e) => patch("ageMin", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      className="w-full rounded-lg bg-black/50 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Età Massima (Anni):</label>
                    <input
                      type="number"
                      placeholder="Es. 70"
                      min={18}
                      max={100}
                      value={filters.ageMax || ""}
                      onChange={(e) => patch("ageMax", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      className="w-full rounded-lg bg-black/50 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Cittadinanza / Origine (Codice Fiscale):</label>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {[
                        { val: false, label: "🌍 Tutti (Italiani & Estero)" },
                        { val: true, label: "🇮🇹 Solo Italiani (Nati in Italia)" },
                      ].map((c) => (
                        <button
                          key={String(c.val)}
                          type="button"
                          onClick={() => patch("onlyItalians", c.val)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            !!filters.onlyItalians === c.val
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                              : "bg-black/40 text-zinc-400 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 mt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!filters.strictNameFilter}
                        onChange={(e) => patch("strictNameFilter", e.target.checked)}
                        className="rounded border-white/10 bg-black/50 text-emerald-500 focus:ring-emerald-500/50"
                      />
                      <span className="text-[11px] text-zinc-300">
                        Filtro Estretto Nome (Esclude W,Y,J,K,X,H o terminanti in U senza CF)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Box Aziende & Imprese */}
            <div className={`rounded-2xl p-4 border transition-all ${
              (filters.target || "all") === "privati"
                ? "bg-black/30 border-white/5 opacity-40 pointer-events-none"
                : "bg-white/5 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.08)]"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-xs text-cyan-400 uppercase font-mono flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Aziende & Imprese (Settore ATECO)
                </span>
                {(filters.target || "all") === "privati" && (
                  <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-mono font-bold">
                    🔒 Solo per Aziende
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-zinc-400 font-semibold block mb-1">
                    Categoria Commerciale o Codice ATECO:
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Ristoranti, Edilizia, Trasporti, Consulenza... (separati da virgola per selezione multipla)"
                    value={filters.categoria || ""}
                    onChange={(e) => patch("categoria", e.target.value)}
                    className="w-full rounded-lg bg-black/50 border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    💡 Puoi digitare più settori contemporaneamente separandoli con una virgola (es. "Ristoranti, Pizzerie, Bar").
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: FILTRO GEOGRAFICO E TERRITORIALE */}
        <div className="py-6 border-b border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm">
                <MapPin className="h-4 w-4" />
              </div>
              <span>3. Localizzazione Geografica (Metodo di Ricerca Territoriale)</span>
            </h3>
            <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
              Multi-Selezione Abilitata
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Seleziona una Macrorregione, Regione, Provincia o inserisci Comuni e CAP. <strong className="text-cyan-300">Nuovo: puoi digitare più province, comuni o CAP separandoli con una virgola (es. "MI, VR, PD" o "Roma, Milano").</strong>
          </p>
          <GeoFilters
            comune={filters.comune}
            provincia={filters.provincia}
            regione={filters.regione}
            cap={filters.cap}
            onComune={(v) => patch("comune", v)}
            onProvincia={(v) => patch("provincia", v)}
            onRegione={(v) => patch("regione", v)}
            onCap={(v) => patch("cap", v)}
          />
        </div>

        {/* SECTION 4: ANTI-DUPLICIDADE / SUPRESSÃO DINÂMICA SOB DEMANDA */}
        <div id="anti-duplicidade" className="py-6 border-b border-amber-500/30 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <span>{t("suppression.section.title")}</span>
            </h3>
            <span className="text-xs font-mono text-amber-300 bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/30 font-bold">
              {t("suppression.section.badge")}
            </span>
          </div>
          <p className="text-xs text-zinc-300">
            {t("suppression.section.desc")}
          </p>
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#0D1215] to-amber-950/15 p-4 shadow-[0_0_35px_rgba(245,158,11,0.1)]">
            <ContactSuppressionUpload
              suppressList={filters.suppressList}
              suppressType={filters.suppressType}
              suppressFileName={filters.suppressFileName}
              onChange={({ suppressList, suppressType, suppressFileName }) => {
                setFilters((f) => ({
                  ...f,
                  suppressList,
                  suppressType,
                  suppressFileName,
                  page: 1,
                }));
              }}
            />
          </div>
        </div>

        {/* SECTION 2: RICERCA TESTUALE & COMANDI DI RICERCA */}
        <div className="mt-6 pt-2 pb-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
              <Search className="h-4 w-4 text-emerald-400" />
              <span>2. Ricerca Specifica per Ragione Sociale, Nome o Cognome (Opzionale)</span>
            </h3>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <SearchBox
                q={filters.q}
                mode={filters.mode}
                onQ={(v) => patch("q", v)}
                onMode={(m) => patch("mode", m)}
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <Button
                variant="outline"
                onClick={copyFiltersForClient}
                className="h-12 border-white/10 bg-black/50 hover:bg-white/5 text-zinc-300 hidden md:flex"
                title="Copia i filtri attuali negli appunti per condividerli"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copia Filtri
              </Button>
              <Button
                onClick={run}
                disabled={searchMut.isPending}
                className="h-12 w-full md:w-auto rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-8 font-bold text-white shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:brightness-110 transition-all text-sm"
                style={{ animation: searchMut.isPending ? undefined : "pulse-ring 2.5s infinite" }}
              >
                <Search className="mr-2 h-4 w-4" />
                {t("cta.search")}
              </Button>
            </div>
          </div>
        </div>

        {/* Sub-bar: Filter Toggles & Blacklist Badge */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition-all ${
                showFilters ? "bg-white/15 text-white border border-white/20" : "bg-white/5 text-zinc-300 hover:bg-white/10 border border-transparent"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
              <span>Filtri Avanzati (Codice Fiscale, P.IVA & Contatti)</span>
              {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold transition-all ${
                showGuide ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-transparent"
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>{showGuide ? "Nascondi Guida Strumenti" : "Spiegazione Strumenti"}</span>
            </button>

            {result && (
              <button
                type="button"
                onClick={() => setShowExport(!showExport)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition-all ${
                  showExport ? "bg-violet-500/20 text-violet-300 border border-violet-500/40" : "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-transparent"
                }`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t("ui.export.btn" as any) || "Pannello Esportazione Big Data"}</span>
                {showExport ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
            {result && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const data = await fetchComuneSummary(filters);
                    let csv = "comune,total\n";
                    data.summary.forEach((r: any) => {
                      csv += `"${r.comune || ''}",${r.total}\n`;
                    });
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = "comune_summary.csv";
                    a.click();
                  } catch (e) {
                    alert("Erro ao gerar resumo");
                  }
                }}
                className="flex items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition-all bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-transparent"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Resumo por Comune (CSV)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowBlacklistModal(true)}
              className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all font-semibold"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t("ui.blacklist.badge" as any) || "Blacklist GDPR Obbligatoria Attiva"}</span>
            </button>
            <button
              type="button"
              onClick={reset}
              className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> {t("cta.reset")}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* COLLAPSIBLE ADVANCED FILTERS PANEL (Fiscal & Contacts) */}
      {showFilters && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid gap-6 md:grid-cols-2">
            <GlassCard className="border-white/10 bg-[#0F1418]/90 border-l-4 border-l-blue-500">
              <h4 className="mb-3 text-sm font-bold text-cyan-400 flex items-center gap-2">
                <span>{t("section.fiscal" as any) || "Filtri Fiscali Italiani (Codice Fiscale & P.IVA)"}</span>
              </h4>
              <FiscalFilters
                cf={filters.cf} pi={filters.pi} hasAzienda={filters.hasAzienda || false}
                onCf={(v) => patch("cf", v)} onPi={(v) => patch("pi", v)}
                onHasAzienda={(v) => patch("hasAzienda", v)}
              />
            </GlassCard>

            <GlassCard className="border-white/10 bg-[#0F1418]/90 border-l-4 border-l-emerald-500">
              <h4 className="mb-3 text-sm font-bold text-emerald-400 flex items-center gap-2">
                <span>{t("section.contacts" as any) || "Filtri Contatti & Conformità GDPR"}</span>
              </h4>
              <ContactFilters
                fixed={filters.require.fixed}
                mobile={filters.require.mobile}
                email={filters.require.email}
                blacklist={filters.blacklist}
                onFixed={(v) => patch("require", { ...filters.require, fixed: v })}
                onMobile={(v) => patch("require", { ...filters.require, mobile: v })}
                onEmail={(v) => patch("require", { ...filters.require, email: v })}
                onBlacklist={(v) => patch("blacklist", v)}
                onOpenBlacklist={() => setShowBlacklistModal(true)}
              />
            </GlassCard>
          </div>
        </div>
      )}

      {/* COLLAPSIBLE EXPORT PANEL ABOVE RESULTS */}
      {showExport && result && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <ExportPanel
            filters={filters}
            totalRows={result.total ?? 0}
            disabled={searchMut.isPending || !result}
          />
        </div>
      )}

      {/* FULL-WIDTH RESULTS TABLE */}
      <div className="w-full">
        <ResultsTable
          result={result}
          filters={filters}
          loading={searchMut.isPending}
          error={searchMut.error}
          awaiting={awaiting}
          onPage={goPage}
        />
      </div>

      {showBlacklistModal && (
        <BlacklistManagerModal onClose={() => setShowBlacklistModal(false)} />
      )}
    </main>
  );
}
