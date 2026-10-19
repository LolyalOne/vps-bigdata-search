import { useState, useRef } from "react";
import { Upload, X, FileCheck, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/lib/i18n";

export function MatchCfModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [table, setTable] = useState("privati_2023");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { t } = useT();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      let token = "";
      if (user) {
        token = await user.getIdToken();
      }
      
      const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${BASE}/api/match_cf?table=${encodeURIComponent(table)}`, {
        method: "POST",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: formData,
      });

      if (!res.ok) {
        let errMsg = `API ${res.status}`;
        try {
          const errBody = await res.json();
          errMsg = errBody.detail || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `match_cf_${table}_results.csv`;
      a.click();
      onClose();
    } catch (e: any) {
      setError(e.message || t("match.error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4">
        <GlassCard strong className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-cyan-400" />
              {t("match.title")}
            </h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 space-y-4 text-sm text-zinc-300">
            <p>{t("match.desc")}</p>

            <div>
              <label className="mb-1.5 block font-semibold text-zinc-400">{t("match.table.label")}</label>
              <select 
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-500"
              >
                <option value="privati_2023">{t("match.table.privati")}</option>
                <option value="nord_totale">{t("match.table.nord")}</option>
                <option value="censud_totale">{t("match.table.censud")}</option>
                <option value="aziende_2023">{t("match.table.aziende")}</option>
                <option value="villette_official_ago_26">{t("match.table.villette")}</option>
              </select>
            </div>

            <div 
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed ${file ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/20 bg-black/20 hover:border-white/40'} p-8 transition-colors`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                className="hidden" 
                accept=".txt,.csv" 
              />
              {file ? (
                <>
                  <FileCheck className="mb-2 h-8 w-8 text-cyan-400" />
                  <span className="font-semibold text-cyan-300">{file.name}</span>
                  <span className="text-xs text-zinc-400 mt-1">{(file.size / 1024).toFixed(1)} KB</span>
                </>
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-zinc-400" />
                  <span className="font-semibold text-zinc-300">{t("match.click")}</span>
                  <span className="text-xs text-zinc-500 mt-1">{t("match.file.type")}</span>
                </>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400">
                {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={onClose} disabled={uploading}>
              {t("match.cancel")}
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!file || uploading}
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              {uploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("match.processing")}</>
              ) : (
                <><FileCheck className="mr-2 h-4 w-4" /> {t("match.submit")}</>
              )}
            </Button>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
