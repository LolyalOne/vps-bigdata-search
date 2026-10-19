import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Shield, Plus, Trash2, CheckCircle2, Database, AlertCircle, Clock, Search, Sparkles, Filter, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

interface Props {
  onClose: () => void;
}

interface BlacklistEntry {
  id: string;
  type: "dominio" | "prefisso" | "cf_piva" | "email" | "numero";
  value: string;
  reason: string;
  addedAt: string;
  isRecent?: boolean;
}

const STORAGE_KEY = "datanexus_blacklist_entries_v3";

const DEFAULT_ENTRIES: BlacklistEntry[] = [
  { id: "100", type: "numero", value: "3388386711", reason: "Normalizzato da +39 - Art. 17 GDPR", addedAt: "13/07/2026 - 01:56", isRecent: true },
  { id: "1", type: "dominio", value: "spam-marketing-italia.it", reason: "Richiesta rimozione GDPR Art. 17", addedAt: "02/07/2026 - 14:20" },
  { id: "2", type: "prefisso", value: "069988", reason: "Call center aggressivo segnalato", addedAt: "01/07/2026 - 11:05" },
  { id: "3", type: "cf_piva", value: "01234560157", reason: "Richiesta opt-out esplicita", addedAt: "28/06/2026 - 09:30" },
  { id: "4", type: "email", value: "*@tempmail.com", reason: "Dominio email temporanea / fraudolenta", addedAt: "15/06/2026 - 16:45" },
];

export function BlacklistManagerModal({ onClose }: Props) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<"blacklist" | "databases">("blacklist");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [entries, setEntries] = useState<BlacklistEntry[]>(DEFAULT_ENTRIES);
  const [dbTotal, setDbTotal] = useState<number>(0);
  const [dbOffset, setDbOffset] = useState<number>(0);
  const [dbLoading, setDbLoading] = useState<boolean>(false);
  const [dbHasMore, setDbHasMore] = useState<boolean>(true);
  const listRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 100;

  const [newType, setNewType] = useState<"dominio" | "prefisso" | "cf_piva" | "email" | "numero">("numero");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [collisionData, setCollisionData] = useState<{
    similarEntries: string[];
    pendingEntry: {
      type: "dominio" | "prefisso" | "cf_piva" | "email" | "numero";
      value: string;
      reason: string;
    };
  } | null>(null);

  // Load a page of entries from the DB API
  const fetchPage = useCallback(async (offset: number, search: string, type: string) => {
    setDbLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (search) params.set("q", search);
      if (type && type !== "all") params.set("type", type);
      const res = await fetch("/api/blacklist?" + params.toString());
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.entries)) {
          const mapped: BlacklistEntry[] = data.entries.map((e: any) => ({
            ...e,
            type: e.type as BlacklistEntry["type"],
          }));
          setDbTotal(data.total ?? 0);
          if (offset === 0) {
            setEntries(mapped);
          } else {
            setEntries((prev) => {
              const existingIds = new Set(prev.map((x) => x.id));
              return [...prev, ...mapped.filter((x) => !existingIds.has(x.id))];
            });
          }
          setDbHasMore(offset + mapped.length < (data.total ?? 0));
          setDbOffset(offset + mapped.length);
        }
      }
    } catch (err) {
      console.error("Errore recupero blacklist", err);
    } finally {
      setDbLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    setDbOffset(0);
    setDbHasMore(true);
    fetchPage(0, searchQuery, filterType);
  }, [fetchPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when search or filter changes
  useEffect(() => {
    setDbOffset(0);
    setDbHasMore(true);
    fetchPage(0, searchQuery, filterType);
  }, [searchQuery, filterType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || dbLoading || !dbHasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      fetchPage(dbOffset, searchQuery, filterType);
    }
  }, [dbLoading, dbHasMore, dbOffset, searchQuery, filterType, fetchPage]);

  // Persiste apenas entradas recentes adicionadas manualmente (não o banco inteiro)
  useEffect(() => {
    try {
      const recent = entries.filter((e) => e.isRecent);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
    } catch (e) {
      console.error("Errore salvataggio blacklist su localStorage", e);
    }
  }, [entries]);

  // Normalizador automático per numeri (rimuove +39, spazi, ecc.)
  const normalizedPreview = useMemo(() => {
    if (newType === "numero" || newType === "prefisso") {
      let clean = newValue.trim().replace(/^\+?39|^0039/, "");
      clean = clean.replace(/\D/g, "");
      return clean;
    }
    return newValue.trim();
  }, [newValue, newType]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    const valueToSave = (newType === "numero" || newType === "prefisso") && normalizedPreview ? normalizedPreview : newValue.trim();
    const reasonToSave = newReason.trim() || "Aggiunto manualmente dall'operatore";

    try {
      const response = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          value: valueToSave,
          reason: reasonToSave,
        }),
      });

      if (response.status === 409) {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || errData.message || "Errore: Conflitto rilevato.");
        return;
      }

      if (response.status === 202) {
        const body = await response.json().catch(() => ({}));
        setCollisionData({
          similarEntries: (body.similar_entries || []).map((e: any) => typeof e === "object" && e ? e.value : e),
          pendingEntry: {
            type: newType,
            value: valueToSave,
            reason: reasonToSave,
          }
        });
        return;
      }

      if (response.status === 200 || response.status === 201) {
        const now = new Date();
        const formattedDate = `${now.toLocaleDateString("it-IT")} - ${now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;

        const resBody = await response.json().catch(() => ({}));
        const newEntry: BlacklistEntry = {
          id: resBody.id || Date.now().toString(),
          type: newType,
          value: valueToSave,
          reason: reasonToSave,
          addedAt: formattedDate,
          isRecent: true,
        };

        setEntries((prev) => [newEntry, ...prev]);
        setNewValue("");
        setNewReason("");
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3500);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || errData.message || `Errore del server: ${response.status}`);
      }
    } catch (err) {
      console.error("Errore salvataggio su API DB Blacklist", err);
      alert("Si è verificato un errore di rete durante il salvataggio.");
    }
  };

  const handleForceAdd = async () => {
    if (!collisionData) return;
    const { pendingEntry } = collisionData;

    try {
      const response = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: pendingEntry.type,
          value: pendingEntry.value,
          reason: pendingEntry.reason,
          force_add: true,
        }),
      });

      if (response.status === 409) {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || errData.message || "Errore: Conflitto rilevato.");
        return;
      }

      if (response.status === 200 || response.status === 201) {
        const now = new Date();
        const formattedDate = `${now.toLocaleDateString("it-IT")} - ${now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;

        const resBody = await response.json().catch(() => ({}));
        const newEntry: BlacklistEntry = {
          id: resBody.id || Date.now().toString(),
          type: pendingEntry.type,
          value: pendingEntry.value,
          reason: pendingEntry.reason,
          addedAt: formattedDate,
          isRecent: true,
        };

        setEntries((prev) => [newEntry, ...prev]);
        setNewValue("");
        setNewReason("");
        setCollisionData(null);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3500);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || errData.message || `Errore del server: ${response.status}`);
      }
    } catch (err) {
      console.error("Errore salvataggio con force_add su API DB Blacklist", err);
      alert("Si è verificato un errore di rete.");
    }
  };

  const handleRemove = async (id: string) => {
    const itemToRemove = entries.find((item) => item.id === id);
    setEntries(entries.filter((item) => item.id !== id));

    if (itemToRemove) {
      try {
        await fetch(`/api/blacklist?value=${encodeURIComponent(itemToRemove.value)}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Errore rimozione da API DB Blacklist", err);
      }
    }
  };

  const recentEntries = useMemo(() => entries.filter((e) => e.isRecent), [entries]);

  return (
    <Dialog open onOpenChange={(o) => !o && (collisionData ? setCollisionData(null) : onClose())}>
      <DialogContent
        aria-describedby={undefined}
        className={collisionData
          ? "max-w-md border border-amber-500/30 bg-[#0A0D0F] p-6 text-white shadow-[0_0_60px_rgba(245,158,11,0.15)]"
          : "max-w-4xl border border-emerald-500/30 bg-[#0A0D0F] p-0 text-white shadow-[0_0_60px_rgba(16,185,129,0.15)]"
        }
      >
        {collisionData ? (
          <div>
            <DialogTitle className="font-display text-lg font-bold text-amber-500 flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 animate-pulse text-amber-400" />
              Atenção: Encontramos entradas similares na Blacklist:
            </DialogTitle>
            
            {collisionData.similarEntries && collisionData.similarEntries.length > 0 && (
              <div className="my-4 max-h-40 overflow-y-auto rounded bg-black/40 p-3 font-mono text-sm border border-white/10 text-zinc-300">
                <ul className="list-disc pl-5 space-y-1">
                  {collisionData.similarEntries.map((val, idx) => (
                    <li key={idx}>{val}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setCollisionData(null)}
                className="bg-white/10 text-white hover:bg-white/20 font-semibold px-4 py-2 rounded text-sm transition-colors"
              >
                Cancelar Inserção
              </button>
              <button
                type="button"
                onClick={handleForceAdd}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded text-sm transition-colors shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              >
                Adicionar Mesmo Assim (Override)
              </button>
            </div>
          </div>
        ) : (
          <div className="relative p-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="font-display text-xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
                    {t("blacklist.modal.title" as any) || "Gestione Blacklist & Conformità Database"}
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
                      GDPR Art. 17
                    </span>
                  </DialogTitle>
                  <p className="text-xs text-zinc-400">
                    {t("blacklist.modal.subtitle" as any) || "Il blocco Blacklist è OBBLIGATORIO per tutti i 34.2M di record. Include normalizzazione automatica dei numeri."}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("blacklist")}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    activeTab === "blacklist"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  Blacklist Completa ({dbTotal.toLocaleString("it-IT")} voci no DB)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("databases")}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    activeTab === "databases"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Database className="h-4 w-4" />
                  {t("blacklist.modal.tab.db" as any) || "Stato Protezione Database (34.2M)"}
                </button>
              </div>

              {recentEntries.length > 0 && activeTab === "blacklist" && (
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span>{recentEntries.length} modifiche recenti alla blacklist</span>
                </div>
              )}
            </div>

            {/* Tab Content: Blacklist */}
            {activeTab === "blacklist" && (
              <div className="mt-5 space-y-5">
                {/* Add form */}
                <form onSubmit={handleAdd} className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 shadow-inner">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                    <Plus className="h-4 w-4" /> Aggiungi e Normalizza Nuova Regola in Blacklist
                  </h4>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">Tipo di Blocco</label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as any)}
                        className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="numero">Numero Telefono / Cellulare</option>
                        <option value="prefisso">Prefisso Telefonico</option>
                        <option value="dominio">Dominio Email (@aziendax.it)</option>
                        <option value="cf_piva">Codice Fiscale / P.IVA</option>
                        <option value="email">Indirizzo Email / Wildcard</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-zinc-400">Valore da Bloccare</label>
                      <input
                        type="text"
                        placeholder={newType === "numero" ? "es. +39 0575 714230 o 3381234567" : "es. @spammer.com oppure 01234567890"}
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none font-mono"
                      />
                      {(newType === "numero" || newType === "prefisso") && newValue && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
                          <Phone className="h-3 w-3" />
                          <span>Normalizzato per DB (senza +39 o spazi): <strong className="font-mono underline">{normalizedPreview}</strong></span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={!newValue.trim()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                      >
                        <Plus className="h-4 w-4" /> Aggiungi e Blocca
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="mb-1 block text-xs text-zinc-400">Motivo / Pratica GDPR</label>
                    <input
                      type="text"
                      placeholder="es. Art. 17 GDPR - Diritto all'oblio / Richiesta diretta operatore"
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  {showSuccess && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Regola aggiunta in cima ai Recenti ed applicata con normalizzazione automatica!
                    </div>
                  )}
                </form>

                {/* Filter & Search Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <Search className="h-4 w-4 text-zinc-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Cerca tra le regole, numeri o motivi..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-zinc-400" />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="rounded-lg border border-white/10 bg-black px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="all">Tutti i tipi</option>
                      <option value="numero">Numeri Telefono</option>
                      <option value="prefisso">Prefissi</option>
                      <option value="dominio">Domini</option>
                      <option value="email">Email</option>
                      <option value="cf_piva">CF / P.IVA</option>
                    </select>
                  </div>
                </div>

                {/* Entries List with Infinite Scroll */}
                <div
                  ref={listRef}
                  onScroll={handleScroll}
                  className="max-h-64 overflow-auto w-full rounded-xl border border-white/10 bg-black/50"
                >
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#0F1417] text-xs uppercase text-zinc-400">
                      <tr>
                        <th className="p-3">Stato</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Valore Bloccato</th>
                        <th className="p-3">Motivo / Pratica GDPR</th>
                        <th className="p-3">Aggiunto Il</th>
                        <th className="p-3 text-right">Azione</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {entries.map((item) => (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            item.isRecent
                              ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                              : "hover:bg-white/5"
                          }`}
                        >
                          <td className="p-3">
                            {item.isRecent ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                <Clock className="h-3 w-3" /> Recente
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                                Attivo
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs text-emerald-400 uppercase font-semibold">{item.type}</td>
                          <td className="p-3 font-mono font-bold text-white tracking-wide">{item.value}</td>
                          <td className="p-3 text-xs text-zinc-300 max-w-[220px] truncate" title={item.reason}>{item.reason}</td>
                          <td className="p-3 text-xs text-zinc-400 whitespace-nowrap">{item.addedAt}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleRemove(item.id)}
                              className="rounded p-1.5 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                              title="Rimuovi regola"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {entries.length === 0 && !dbLoading && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-sm text-zinc-500">
                            Nessuna regola trovata per il filtro selezionato.
                          </td>
                        </tr>
                      )}
                      {dbLoading && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center">
                            <div className="inline-flex items-center gap-2 text-xs text-emerald-400">
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                              Caricamento voci dal database...
                            </div>
                          </td>
                        </tr>
                      )}
                      {!dbHasMore && entries.length > 0 && !dbLoading && (
                        <tr>
                          <td colSpan={6} className="p-3 text-center text-[10px] text-zinc-600">
                            ✓ {entries.length.toLocaleString("it-IT")} di {dbTotal.toLocaleString("it-IT")} voci caricate
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab Content: Databases */}
            {activeTab === "databases" && (
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-xs text-cyan-300">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>
                    {t("blacklist.modal.alert" as any) || "Tutte le 11 basi dati italiane sono costantemente monitorate dal filtro Blacklist e dai criteri di privacy GDPR della piattaforma"} <strong className="text-white">DataNexus Analytics</strong>
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { name: "Anagrafica Globale Italia", rows: "34.2M", status: "Protetto · Conformità GDPR" },
                    { name: "Persone Fisiche & Residenze", rows: "18.5M", status: "Protetto · Art. 17 GDPR" },
                    { name: "Imprese, Partite IVA & PEC", rows: "6.8M", status: "Protetto · Filtro Antispam" },
                    { name: "Professionisti & Albi", rows: "3.1M", status: "Protetto · Conformità GDPR" },
                    { name: "Catasto & Immobili", rows: "5.8M", status: "Protetto · Dati Sensibili" },
                  ].map((db, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5">
                      <div>
                        <div className="font-semibold text-white text-sm">{db.name}</div>
                        <div className="text-xs text-emerald-400 font-mono">{db.status}</div>
                      </div>
                      <div className="rounded-lg bg-black/40 px-2.5 py-1 text-xs font-mono font-bold text-cyan-400 border border-white/10">
                        {db.rows}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-zinc-400">
              <span>{t("blacklist.modal.footer" as any) || "Sviluppato e gestito da"} <strong className="text-white">DataNexus Analytics</strong></span>
              <Button
                onClick={onClose}
                className="bg-white/10 text-white hover:bg-white/20 font-semibold px-6"
              >
                {t("blacklist.modal.close" as any) || "Chiudi Finestra"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

