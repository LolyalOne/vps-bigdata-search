import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  ShieldAlert,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  HelpCircle,
  Database,
  Info,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

interface ContactSuppressionUploadProps {
  suppressList?: string[];
  suppressType?: "mobile" | "fixed" | "email" | "cf" | "auto";
  suppressFileName?: string;
  onChange: (data: {
    suppressList?: string[];
    suppressType?: "mobile" | "fixed" | "email" | "cf" | "auto";
    suppressFileName?: string;
  }) => void;
}

interface ParsedColumn {
  header: string;
  samples: string[];
}

export function ContactSuppressionUpload({
  suppressList = [],
  suppressType = "auto",
  suppressFileName = "",
  onChange,
}: ContactSuppressionUploadProps) {
  const { t } = useT();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessFileName, setAccessFileName] = useState("");
  const [columns, setColumns] = useState<ParsedColumn[]>([]);
  const [selectedColIndex, setSelectedColIndex] = useState<number>(0);
  const [rawRowsCount, setRawRowsCount] = useState<number>(0);
  const [duplicatesCount, setDuplicatesCount] = useState<number>(0);
  const [invalidCount, setInvalidCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeContact = (raw: string): string | null => {
    if (!raw) return null;
    const str = String(raw).trim();
    if (!str) return null;

    // Check if email
    if (str.includes("@") && str.includes(".")) {
      return str.toLowerCase();
    }

    // Check if Fiscal Code (16 chars alphanumeric) or PI (11 digits)
    if (/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(str)) {
      return str.toUpperCase();
    }

    // Clean phone numbers (keep digits only)
    const digitsOnly = str.replace(/\D/g, "");
    if (digitsOnly.length >= 6 && digitsOnly.length <= 15) {
      return digitsOnly;
    }

    // Fallback: if it has at least 4 chars, return clean
    return str.length >= 4 ? str : null;
  };

  const processValues = (values: string[], fileName: string) => {
    setRawRowsCount(values.length);
    const uniqueSet = new Set<string>();
    let invalid = 0;
    let dups = 0;

    values.forEach((v) => {
      const norm = normalizeContact(v);
      if (!norm) {
        invalid++;
      } else if (uniqueSet.has(norm)) {
        dups++;
      } else {
        uniqueSet.add(norm);
      }
    });

    const list = Array.from(uniqueSet);
    setDuplicatesCount(dups);
    setInvalidCount(invalid);
    onChange({
      suppressList: list,
      suppressType: "auto",
      suppressFileName: fileName,
    });
  };

  const handleFileUpload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    // Intercept Microsoft Access (.accdb / .mdb) files immediately
    if (ext === "accdb" || ext === "mdb") {
      setAccessFileName(file.name);
      setShowAccessModal(true);
      return;
    }

    setIsProcessing(true);
    try {
      if (ext === "csv" || ext === "txt") {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as Record<string, any>[];
            const headers = results.meta.fields || [];
            if (headers.length > 0 && data.length > 0) {
              const cols: ParsedColumn[] = headers.map((h) => ({
                header: h,
                samples: data.slice(0, 5).map((r) => String(r[h] ?? "")),
              }));
              setColumns(cols);

              // Auto-select best column
              const bestIdx = headers.findIndex((h) =>
                /cell|tel|mob|phone|email|mail|cf|fiscale|contat/i.test(h)
              );
              const idx = bestIdx >= 0 ? bestIdx : 0;
              setSelectedColIndex(idx);

              const colName = headers[idx];
              const vals = data.map((r) => String(r[colName] ?? ""));
              processValues(vals, file.name);
            } else {
              // Parse as array of strings
              Papa.parse(file, {
                header: false,
                skipEmptyLines: true,
                complete: (res) => {
                  const rows = res.data as string[][];
                  const vals = rows.map((r) => String(r[0] ?? ""));
                  processValues(vals, file.name);
                },
              });
            }
            setIsProcessing(false);
          },
          error: () => setIsProcessing(false),
        });
      } else {
        // Excel (.xlsx, .xls)
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });

        if (jsonRows.length > 1) {
          const headers = (jsonRows[0] as string[]).map((h) => String(h || "Colonna"));
          const dataRows = jsonRows.slice(1);

          const cols: ParsedColumn[] = headers.map((h, colIdx) => ({
            header: h,
            samples: dataRows.slice(0, 5).map((r) => String(r[colIdx] ?? "")),
          }));
          setColumns(cols);

          const bestIdx = headers.findIndex((h) =>
            /cell|tel|mob|phone|email|mail|cf|fiscale|contat/i.test(h)
          );
          const idx = bestIdx >= 0 ? bestIdx : 0;
          setSelectedColIndex(idx);

          const vals = dataRows.map((r) => String(r[idx] ?? ""));
          processValues(vals, file.name);
        }
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Erro ao analisar arquivo:", err);
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = () => {
    setColumns([]);
    setRawRowsCount(0);
    setDuplicatesCount(0);
    setInvalidCount(0);
    onChange({
      suppressList: undefined,
      suppressType: "auto",
      suppressFileName: undefined,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const hasSuppression = suppressList && suppressList.length > 0;

  return (
    <div className="space-y-3">
      {/* ACCESS GUIDED MODAL FOR .accdb / .mdb FILES */}
      {showAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-[#0F1418] p-6 text-white shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5 text-amber-400 font-bold">
                <AlertTriangle className="h-6 w-6" />
                <span>Arquivo Access Detectado ({accessFileName})</span>
              </div>
              <button
                onClick={() => setShowAccessModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
              <p>
                Para proteger a estabilidade do servidor Linux e garantir tempo de resposta ultrarrápido em memória, arquivos nativos de banco de dados Access (<strong>.accdb / .mdb</strong>) requerem exportação rápida prévia.
              </p>
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 space-y-2 text-xs">
                <span className="font-bold text-amber-300 block">
                  Como converter em 3 cliques no Microsoft Access:
                </span>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-200">
                  <li>Abra a tabela com a lista de exclusão no Microsoft Access.</li>
                  <li>
                    Clique na aba <strong>Dados Externos &gt; Exportar &gt; Excel (.xlsx)</strong> ou <strong>Arquivo de Texto (.csv)</strong>.
                  </li>
                  <li>
                    Arraste ou selecione o arquivo <strong>.xlsx</strong> ou <strong>.csv</strong> exportado aqui.
                  </li>
                </ol>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setShowAccessModal(false)}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-5"
              >
                Entendi, vou anexar em .XLSX ou .CSV
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER / EXPLANATION */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4" />
          Módulo de Supressão Anti-Duplicidade (Exclusão Sob Demanda)
        </label>
        {hasSuppression && (
          <button
            type="button"
            onClick={handleRemove}
            className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-semibold"
          >
            <X className="h-3.5 w-3.5" />
            Remover Lista de Exclusão
          </button>
        )}
      </div>

      {/* COMPACT ACTIVE LIST STATE */}
      {hasSuppression ? (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{suppressFileName || "lista_clientes.xlsx"}</span>
                  <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-extrabold text-cyan-300">
                    {suppressList.length.toLocaleString()} contatos ativos
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  {rawRowsCount.toLocaleString()} processados · {duplicatesCount.toLocaleString()} duplicatas removidas · {invalidCount.toLocaleString()} inválidos ignorados
                </div>
              </div>
            </div>

            {columns.length > 1 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 font-medium">Coluna extraída:</span>
                <select
                  value={selectedColIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSelectedColIndex(idx);
                    // Reprocess with this column
                  }}
                  className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1 text-white text-xs font-semibold focus:border-cyan-400 focus:outline-none"
                >
                  {columns.map((c, idx) => (
                    <option key={idx} value={idx}>
                      {c.header}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* PREVIEW FIRST 4 CONTACTS */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10">
            <span className="text-xs text-zinc-400 mr-1 font-medium">Amostra excludente:</span>
            {suppressList.slice(0, 4).map((item, idx) => (
              <span
                key={idx}
                className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-xs font-mono text-cyan-300"
              >
                {item}
              </span>
            ))}
            {suppressList.length > 4 && (
              <span className="text-xs text-zinc-500">
                +{(suppressList.length - 4).toLocaleString()} outros
              </span>
            )}
          </div>
        </div>
      ) : (
        /* DRAG AND DROP ZONE */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
            isDragging
              ? "border-cyan-400 bg-cyan-500/10 scale-[1.01]"
              : "border-white/15 bg-white/[0.02] hover:border-cyan-500/40 hover:bg-white/[0.04]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt,.accdb,.mdb"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
            {isProcessing ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </div>

          <div className="text-sm font-semibold text-white">
            {isProcessing ? (
              "Processando arquivo e normalizando contatos..."
            ) : (
              <>
                {t("suppression.drop.title")}
                <span className="text-cyan-400 underline decoration-cyan-400/40 underline-offset-4">
                  {t("suppression.drop.browse")}
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-400 max-w-md">
            {t("suppression.drop.sub")}
          </p>
        </div>
      )}
    </div>
  );
}
