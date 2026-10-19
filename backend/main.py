import os
import csv
import re
import time
import uuid
import json
import asyncio
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, Header, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from pydantic import BaseModel, Field
import asyncpg

app = FastAPI(title="Italian Big Data API", version="1.0.0")

# Enable CORS for Lovable previews and external domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length"],
)

DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres@127.0.0.1:5432/bigdata_db")
EXPORT_DIR = os.getenv("EXPORT_DIR", "/tmp/exports")
db_pool: Optional[asyncpg.Pool] = None
export_semaphore = asyncio.Semaphore(2)

async def verify_auth_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Não autorizado: Token de autenticação ausente ou inválido.")
    return authorization


# Global dictionary to track export jobs
export_jobs: Dict[str, Dict[str, Any]] = {}
_comuni_cache: List[Dict[str, str]] = []
_provincia_cache_sigla_to_nome: Dict[str, List[str]] = {}
_provincia_cache_nome_to_sigla: Dict[str, str] = {}


ERROR_MAPPINGS = {
    "NICCOL<ERROR>": "NICCOLÒ", "VIGAN<ERROR>": "VIGANÒ", "MACR<ERROR>": "MACRÌ",
    "CAL<ERROR>": "CALÒ", "SPAN<ERROR>": "SPANÒ", "DON<ERROR>": "DONÀ",
    "GI<ERROR>": "GIÒ", "MUL<ERROR>": "MULÈ", "ZAPPAL<ERROR>": "ZAPPALÀ",
    "REN<ERROR>": "RENÈ", "PODEST<ERROR>": "PODESTÀ", "RODRGUEZ<ERROR>": "RODRÍGUEZ",
    "TROV<ERROR>": "TROVÒ", "GIOSU<ERROR>": "GIOSUÈ", "LAGAN<ERROR>": "LAGANÀ",
    "GNTHER<ERROR>": "GÜNTHER", "TOT<ERROR>": "TOTÒ", "CALABR<ERROR>": "CALABRÒ",
    "ORR<ERROR>": "ORRÙ", "ZANDON<ERROR>": "ZANDONÀ", "SOLD<ERROR>": "SOLDÀ",
    "LUC<ERROR>": "LUCÀ", "PREZ<ERROR>": "PÉREZ", "LPEZ<ERROR>": "LÓPEZ",
    "CANT<ERROR>": "CANTÙ", "GULL<ERROR>": "GULLÌ", "SCARF<ERROR>": "SCARFÒ",
    "ROMAN<ERROR>": "ROMANÒ", "MICCICH<ERROR>": "MICCICHÈ", "RICC<ERROR>": "RICCÒ",
    "SACC<ERROR>": "SACCÀ", "MARA<ERROR>": "MARÍA", "JOS<ERROR>": "JOSÉ",
    "AL<ERROR>": "ALÌ", "GIUFFR<ERROR>": "GIUFFRÈ", "MARIL<ERROR>": "MARILÙ",
    "DESS<ERROR>": "DESSÌ", "MAS<ERROR>": "MASÌ", "VADAL<ERROR>": "VADALÀ",
    "VOLONT<ERROR>": "VOLONTÈ", "CANNAV<ERROR>": "CANNAVÒ", "MOS<ERROR>": "MOSÈ",
    "BELL<ERROR>": "BELLÌ", "MARCIAN<ERROR>": "MARCIANÒ", "FRANZ<ERROR>": "FRANZÒ",
    "L<ERROR>": "LÌ", "PATERN<ERROR>": "PATERNÒ", "NO<ERROR>": "NOÈ",
    "SAMOR<ERROR>": "SAMORÌ", "DESIRE<ERROR>": "DESIRÈ", "M<ERROR>": "MÌ",
    "GONZLEZ<ERROR>": "GONZÁLEZ", "TRAOR<ERROR>": "TRAORÉ", "R<ERROR>": "RÌ",
    "MANF<ERROR>": "MANFÈ", "PANT<ERROR>": "PANTÒ", "IANN<ERROR>": "IANNÌ",
    "SAM<ERROR>": "SAMÙ", "ZOPP<ERROR>": "ZOPPÌ", "VERNICA<ERROR>": "VERÓNICA",
    "DAV<ERROR>": "DAVÌ", "BENVEGN<ERROR>": "BENVEGNÙ", "IONU<ERROR>": "IONUȚ",
    "MARTNEZ<ERROR>": "MARTÍNEZ", "GIANN<ERROR>": "GIANNÌ", "CORR<ERROR>": "CORRÀ",
    "GERMAN<ERROR>": "GERMANÀ", "COL<ERROR>": "COLÒ", "PETTEN<ERROR>": "PETTENÒ",
    "MAN<ERROR>": "MANÙ", "MANFR<ERROR>": "MANFRÈ", "GIAMP<ERROR>": "GIAMPÈ",
    "ANDR<ERROR>": "ANDRÈ", "PATAN<ERROR>": "PATANÈ", "CAS<ERROR>": "CASÒ",
    "MAGR<ERROR>": "MAGRÌ", "SGR<ERROR>": "SGRÒ", "BONAF<ERROR>": "BONAFÈ",
    "SANZ<ERROR>": "SÁNCHEZ", "SNCHEZ<ERROR>": "SÁNCHEZ", "D'AL<ERROR>": "D'ALÌ",
    "GIOFFR<ERROR>": "GIOFFRÈ", "P<ERROR>": "PÌ", "BANN<ERROR>": "BANNÒ",
    "PRATIC<ERROR>": "PRATICÒ", "VALRIE<ERROR>": "VALÉRIE", "BANCAL<ERROR>": "BANCALÀ",
    "FUS<ERROR>": "FUSÒ", "SCHILIR<ERROR>": "SCHILIRÒ", "LIB<ERROR>": "LIBÈ",
    "LEN<ERROR>": "LENÌ", "SCIR<ERROR>": "SCIRÈ", "BA<ERROR>": "BAÙ",
    "FAM<ERROR>": "FAMÀ", "MUNAF<ERROR>": "MUNAFÒ", "NISTIC<ERROR>": "NISTICÒ",
    "MLLER<ERROR>": "MÜLLER", "DU<ERROR>": "DUÈ", "BUTT<ERROR>": "BUTTÌ",
    "FANTAPPI<ERROR>": "FANTAPPIÈ", "CER<ERROR>": "CERÒ", "DIPR<ERROR>": "DIPRÈ",
    "CANAV<ERROR>": "CANAVÈ"
}

def clean_error_string(val):
    if val is None:
        return ""
    if not isinstance(val, str):
        val = str(val)
    if "<ERROR>" in val:
        # If it's a known mapping, replace it
        for err_word, correct_word in ERROR_MAPPINGS.items():
            if err_word in val:
                val = val.replace(err_word, correct_word)
        # If there are any <ERROR> left, fallback to apostrophe
        if "<ERROR>" in val:
            val = val.replace("<ERROR>", "'")
    # Replace embedded control characters (\r, \n, \t) with spaces
    if any(c in val for c in ('\r', '\n', '\t')):
        val = re.sub(r'[\r\n\t]+', ' ', val)
    # Strip leading/trailing whitespaces
    val = val.strip()
    # Sanitize formula injection triggers (=, +, -, @)
    if val:
        if val[0] in ('=', '@'):
            val = "'" + val
        elif val[0] in ('+', '-') and not re.match(r'^[+-]?\d+(?:[\s./-]\d+)*$', val):
            val = "'" + val
    return val

CANONICAL_PROJECTIONS = {
    "privati_2023": """
        COALESCE(id::text, '') AS id,
        COALESCE(nome::text, '') AS nome,
        COALESCE(cognome::text, '') AS cognome,
        TRIM(CONCAT(COALESCE(cognome::text, ''), ' ', COALESCE(nome::text, ''))) AS nominativo,
        codice_fiscale::text AS codice_fiscale,
        comune::text AS comune,
        provincia::text AS provincia,
        COALESCE(cap::text, '') AS cap,
        COALESCE(indirizzo::text, '') AS indirizzo,
        ''::text AS cellulare,
        COALESCE(numtelcompl::text, '') AS numtelcompl,
        ''::text AS email,
        COALESCE(annon::text, '') AS annon,
        ''::text AS sesso,
        COALESCE(origine_etnica::text, '') AS origine_etnica,
        COALESCE(seconda_generazione::text, 'false') AS seconda_generazione,
        CASE WHEN COALESCE(has_azienda, false) THEN 'Sì' ELSE 'No' END AS impresa
    """,
    "nord_totale": """
        COALESCE(id::text, '') AS id,
        COALESCE(nome::text, '') AS nome,
        COALESCE(cognome::text, '') AS cognome,
        COALESCE(nominativo::text, TRIM(CONCAT(COALESCE(cognome::text, ''), ' ', COALESCE(nome::text, '')))) AS nominativo,
        cf::text AS codice_fiscale,
        citta::text AS comune,
        prov::text AS provincia,
        COALESCE(cap::text, '') AS cap,
        COALESCE(indirizzo::text, '') AS indirizzo,
        COALESCE(cellulare::text, '') AS cellulare,
        ''::text AS numtelcompl,
        ''::text AS email,
        COALESCE(annon::text, '') AS annon,
        COALESCE(sesso::text, '') AS sesso,
        COALESCE(origine_etnica::text, '') AS origine_etnica,
        COALESCE(seconda_generazione::text, 'false') AS seconda_generazione,
        CASE WHEN COALESCE(has_azienda, false) THEN 'Sì' ELSE 'No' END AS impresa
    """,
    "censud_totale": """
        COALESCE(id::text, '') AS id,
        COALESCE(nome::text, '') AS nome,
        COALESCE(cognome::text, '') AS cognome,
        COALESCE(nominativo::text, TRIM(CONCAT(COALESCE(cognome::text, ''), ' ', COALESCE(nome::text, '')))) AS nominativo,
        cf::text AS codice_fiscale,
        citta::text AS comune,
        prov::text AS provincia,
        COALESCE(cap::text, '') AS cap,
        COALESCE(indirizzo::text, '') AS indirizzo,
        COALESCE(cellulare::text, '') AS cellulare,
        ''::text AS numtelcompl,
        ''::text AS email,
        COALESCE(annon::text, '') AS annon,
        COALESCE(sesso::text, '') AS sesso,
        COALESCE(origine_etnica::text, '') AS origine_etnica,
        COALESCE(seconda_generazione::text, 'false') AS seconda_generazione,
        CASE WHEN COALESCE(has_azienda, false) THEN 'Sì' ELSE 'No' END AS impresa
    """,
    "email_privati": """
        COALESCE(id::text, '') AS id,
        COALESCE(nome_clean::text, '') AS nome,
        COALESCE(cognome_clean::text, '') AS cognome,
        COALESCE(cognome_e_nome::text, '') AS nominativo,
        cf::text AS codice_fiscale,
        comune::text AS comune,
        provincia::text AS provincia,
        COALESCE(cap::text, '') AS cap,
        COALESCE(via::text, '') AS indirizzo,
        ''::text AS cellulare,
        ''::text AS numtelcompl,
        COALESCE(email::text, '') AS email,
        COALESCE(annon::text, '') AS annon,
        COALESCE(sesso::text, '') AS sesso,
        COALESCE(origine_etnica::text, '') AS origine_etnica,
        COALESCE(seconda_generazione::text, 'false') AS seconda_generazione,
        'No'::text AS impresa
    """,
    "villette_official_ago_26": """
        ''::text AS id,
        ''::text AS nome,
        ''::text AS cognome,
        COALESCE(nominativo::text, '') AS nominativo,
        cf::text AS codice_fiscale,
        citta::text AS comune,
        COALESCE(pv::text, '') AS provincia,
        COALESCE(cap::text, '') AS cap,
        COALESCE(indirizzo::text, '') AS indirizzo,
        COALESCE(cellulare::text, '') AS cellulare,
        ''::text AS numtelcompl,
        ''::text AS email,
        COALESCE(annon::text, '') AS annon,
        COALESCE(sesso::text, '') AS sesso,
        ''::text AS origine_etnica,
        'false'::text AS seconda_generazione,
        'No'::text AS impresa
    """,
    "isole_finalissimo": """
        ''::text AS id,
        ''::text AS nome,
        ''::text AS cognome,
        COALESCE(nominativo::text, '') AS nominativo,
        COALESCE("CF"::text, '') AS codice_fiscale,
        citta::text AS comune,
        prov::text AS provincia,
        COALESCE(cap::text, '') AS cap,
        COALESCE(indirizzo::text, '') AS indirizzo,
        COALESCE(cellulare::text, '') AS cellulare,
        ''::text AS numtelcompl,
        ''::text AS email,
        COALESCE(annon::text, '') AS annon,
        COALESCE(sesso::text, '') AS sesso,
        ''::text AS origine_etnica,
        'false'::text AS seconda_generazione,
        'No'::text AS impresa
    """,
    "aziende_2023": """
        ''::text AS id,
        COALESCE(rag_soc::text, '') AS rag_soc,
        COALESCE(partita_iva::text, '') AS partita_iva,
        codice_fiscale::text AS codice_fiscale,
        comune::text AS comune,
        provincia::text AS provincia,
        COALESCE(cap::text, '') AS cap,
        COALESCE(indirizzo::text, '') AS indirizzo,
        ''::text AS cellulare,
        COALESCE(numtelcompl::text, '') AS numtelcompl,
        ''::text AS email,
        ''::text AS pec,
        ''::text AS fatturato,
        ''::text AS dipendenti,
        COALESCE(categoria::text, '') AS settore,
        COALESCE(cod_ateco::text, '') AS cod_ateco
    """,
    "aziende_cell_tot_glob_verificate_2023": """
        COALESCE(id::text, '') AS id,
        COALESCE(rgs::text, '') AS rag_soc,
        COALESCE(pi::text, '') AS partita_iva,
        cf::text AS codice_fiscale,
        comune::text AS comune,
        provincia::text AS provincia,
        COALESCE(cap::text, '') AS cap,
        COALESCE(indirizzo::text, '') AS indirizzo,
        COALESCE(cellulare::text, '') AS cellulare,
        ''::text AS numtelcompl,
        ''::text AS email,
        ''::text AS pec,
        COALESCE(fatt::text, '') AS fatturato,
        COALESCE(dip::text, '') AS dipendenti,
        COALESCE(cat::text, '') AS settore,
        COALESCE(codiceateco::text, '') AS cod_ateco
    """,
    "aziende_fissi_2025_completo": """
        ''::text AS id,
        COALESCE(ragsociale::text, '') AS rag_soc,
        ''::text AS partita_iva,
        ''::text AS codice_fiscale,
        COALESCE(localita::text, '') AS comune,
        prov::text AS provincia,
        COALESCE(cap::text, '') AS cap,
        COALESCE(indirizzo::text, '') AS indirizzo,
        ''::text AS cellulare,
        COALESCE(tel::text, '') AS numtelcompl,
        ''::text AS email,
        ''::text AS pec,
        ''::text AS fatturato,
        ''::text AS dipendenti,
        COALESCE(categoria::text, '') AS settore,
        ''::text AS cod_ateco
    """,
    "aziende_fissi_2025_pi_cf": """
        ''::text AS id,
        COALESCE(ragsociale::text, '') AS rag_soc,
        COALESCE(iva::text, '') AS partita_iva,
        cf::text AS codice_fiscale,
        COALESCE(localita::text, '') AS comune,
        prov::text AS provincia,
        COALESCE(cap::text, '') AS cap,
        COALESCE(indirizzo::text, '') AS indirizzo,
        ''::text AS cellulare,
        COALESCE(tel::text, '') AS numtelcompl,
        ''::text AS email,
        ''::text AS pec,
        ''::text AS fatturato,
        ''::text AS dipendenti,
        COALESCE(categoria::text, '') AS settore,
        ''::text AS cod_ateco
    """
}
# Metadata for the 13 Italian tables (counts updated 2026-09-03)
TABLES_METADATA = [
    {
        "id": "aziende_2023",
        "label": {"it": "Aziende 2023", "pt": "Empresas 2023"},
        "description": {"it": "Registro generale delle imprese e aziende italiane anno 2023", "pt": "Registro geral das empresas e negócios italianos ano 2023"},
        "rowCount": 1399174,
        "category": "azienda",
        "columns": ["rag_soc", "partita_iva", "codice_fiscale", "indirizzo", "comune", "provincia", "cap", "numtelcompl", "cod_ateco"]
    },
    {
        "id": "aziende_cell_tot_glob_verificate_2023",
        "label": {"it": "Aziende Cellulari Verificati 2023", "pt": "Empresas Celulares Verificados 2023"},
        "description": {"it": "Base dati numerazioni mobili aziendali verificate con partita iva", "pt": "Base de dados números móveis corporativos verificados com CNPJ/PI"},
        "rowCount": 1408314,
        "category": "azienda",
        "columns": ["rgs", "pi", "cf", "indirizzo", "comune", "provincia", "cap", "cellulare", "codiceateco"]
    },
    {
        "id": "aziende_fissi_2025_completo",
        "label": {"it": "Aziende Fissi 2025 Completo", "pt": "Empresas Fixos 2025 Completo"},
        "description": {"it": "Elenco telefonico nazionale aziendale fisso aggiornato 2025", "pt": "Lista telefônica nacional corporativa fixa atualizada 2025"},
        "rowCount": 2211901,
        "category": "azienda",
        "columns": ["ragsociale", "indirizzo", "localita", "prov", "cap", "tel", "categoria"]
    },
    {
        "id": "aziende_fissi_2025_pi_cf",
        "label": {"it": "Aziende Fissi 2025 (PI + CF)", "pt": "Empresas Fixos 2025 (PI + CF)"},
        "description": {"it": "Sottoinsieme aziende fissi 2025 con identificatori fiscali validati", "pt": "Subconjunto empresas fixos 2025 com identificadores fiscais validados"},
        "rowCount": 1875890,
        "category": "azienda",
        "columns": ["ragsociale", "iva", "cf", "indirizzo", "localita", "prov", "cap", "tel", "categoria"]
    },
    {
        "id": "privati_2023",
        "label": {"it": "Privati Cittadini 2023", "pt": "Pessoas Físicas Cidadãos 2023"},
        "description": {"it": "Anagrafica residenti italiani con codice fiscale e indirizzo di domicilio", "pt": "Cadastro de residentes italianos com CPF e endereço domiciliar"},
        "rowCount": 3079420,
        "category": "privato",
        "columns": ["cognome", "nome", "codice_fiscale", "indirizzo", "comune", "provincia", "cap", "numtelcompl", "annon"]
    },
    {
        "id": "nord_totale",
        "label": {"it": "Macroregione Nord Totale", "pt": "Macro-região Norte Total"},
        "description": {"it": "Aggregazione censuaria completa residenti e contatti Nord Italia", "pt": "Agregação censitária completa residentes e contatos Norte da Itália"},
        "rowCount": 9973156,
        "category": "censo",
        "columns": ["cognome", "nome", "nominativo", "cf", "indirizzo", "citta", "prov", "cap", "cellulare", "annon", "sesso", "origine_etnica", "seconda_generazione"]
    },
    {
        "id": "censud_totale",
        "label": {"it": "Macroregione Centro-Sud Totale", "pt": "Macro-região Centro-Sul Total"},
        "description": {"it": "Aggregazione censuaria completa residenti e contatti Centro e Sud Italia", "pt": "Agregação censitária completa residentes e contatos Centro e Sul da Itália"},
        "rowCount": 10929972,
        "category": "censo",
        "columns": ["cognome", "nome", "nominativo", "cf", "indirizzo", "citta", "prov", "cap", "cellulare", "annon", "sesso", "origine_etnica", "seconda_generazione"]
    },
    {
        "id": "villette_official_ago_26",
        "label": {"it": "Villette / Villas Official 2026", "pt": "Villas / Villette Oficiais 2026"},
        "description": {"it": "Database residenziale Villette e Ville con telefoni cellulari verificate", "pt": "Banco residencial Villette e Villas com telefones celulares verificados"},
        "rowCount": 6092826,
        "category": "censo",
        "columns": ["cellulare", "nominativo", "pv", "cap", "citta", "indirizzo", "annon", "sesso", "tipo", "cf"]
    },
    {
        "id": "isole_finalissimo",
        "label": {"it": "Macroregione Isole Finalissimo", "pt": "Macrorregião Ilhas Finalíssimo"},
        "description": {"it": "Censimento contatti residenti Sicilia e Sardegna", "pt": "Censo de contatos residentes na Sicília e Sardenha"},
        "rowCount": 2318948,
        "category": "censo",
        "columns": ["cellulare", "nominativo", "indirizzo", "cap", "citta", "prov", "cf", "regione", "sesso", "annon"]
    },
    {
        "id": "email_privati",
        "label": {"it": "E-mail Privati Consensuati", "pt": "E-mails Pessoas Físicas Consensuados"},
        "description": {"it": "Database contatti e-mail di cittadini italiani con consenso marketing", "pt": "Banco de contatos e-mail de cidadãos italianos com consentimento opt-in"},
        "rowCount": 1425910,
        "category": "privato",
        "columns": ["cognome_clean", "nome_clean", "cognome_e_nome", "cf", "via", "comune", "provincia", "cap", "email", "sesso", "annon", "origine_etnica", "seconda_generazione"]
    },
    {
        "id": "blacklist_email",
        "label": {"it": "Blacklist E-mail", "pt": "Blacklist E-mail"},
        "description": {"it": "Esclusione regolatoria GDPR e indirizzi non consensuati", "pt": "Exclusão regulatória GDPR e endereços sem consentimento"},
        "rowCount": 1564689,
        "category": "blacklist",
        "columns": ["mail"]
    },
    {
        "id": "blacklist_mobile",
        "label": {"it": "Blacklist Mobile", "pt": "Blacklist Móvel"},
        "description": {"it": "Esclusione numerazioni mobili opt-out e registro opposizioni", "pt": "Exclusão números móveis opt-out e registro de oposições"},
        "rowCount": 345203,
        "category": "blacklist",
        "columns": ["cell"]
    },
    {
        "id": "comuni",
        "label": {"it": "Comuni Italia", "pt": "Municípios Itália"},
        "description": {"it": "Elenco ufficiale dei Comuni e delle Province italiane", "pt": "Lista oficial dos Municípios e Províncias italianas"},
        "rowCount": 28379,
        "category": "geo",
        "columns": ["citta"]
    }
]

async def cleanup_old_exports():
    while True:
        try:
            if os.path.exists(EXPORT_DIR):
                now = time.time()
                for f in os.listdir(EXPORT_DIR):
                    p = os.path.join(EXPORT_DIR, f)
                    if os.path.isfile(p) and os.stat(p).st_mtime < now - 7200:
                        os.remove(p)
        except Exception as e:
            print(f"Erro na limpeza de exports: {e}")
        await asyncio.sleep(1800)

async def load_comuni_cache():
    global _comuni_cache, db_pool, _provincia_cache_nome_to_sigla
    try:
        if db_pool:
            if not _provincia_cache_nome_to_sigla:
                await load_provincia_cache()
            async with db_pool.acquire() as conn:
                query = """
                    FROM privati_2023
                    WHERE comune IS NOT NULL AND TRIM(comune) <> ''
                      AND provincia IS NOT NULL AND LENGTH(TRIM(provincia)) >= 2
                      AND TRIM(provincia) !~ '^[0-9]+$'
                    ORDER BY UPPER(TRIM(provincia)), TRIM(comune);
                """
                rows = await conn.fetch(query, timeout=15.0)
                _comuni_cache = []
                for r in rows:
                    p_name = r["prov"].strip()
                    p_sigla = _provincia_cache_nome_to_sigla.get(p_name, p_name) if len(p_name) > 2 else p_name
                    _comuni_cache.append({"name": r["name"], "prov": p_sigla, "prov_name": p_name})
                print(f"✅ Loaded {len(_comuni_cache)} distinct comuni from database into cache.")
    except Exception as e:
        print(f"⚠️ Failed to load comuni cache: {e}")

async def load_provincia_cache():
    global _provincia_cache_sigla_to_nome, _provincia_cache_nome_to_sigla, db_pool
    try:
        if db_pool:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch("SELECT UPPER(sigla) AS sigla, UPPER(nome_completo) AS nome FROM provincia_mapping;")
                _provincia_cache_sigla_to_nome.clear()
                _provincia_cache_nome_to_sigla.clear()
                for r in rows:
                    sig = r["sigla"].strip()
                    nome = r["nome"].strip()
                    if sig not in _provincia_cache_sigla_to_nome:
                        _provincia_cache_sigla_to_nome[sig] = []
                    _provincia_cache_sigla_to_nome[sig].append(nome)
                    _provincia_cache_nome_to_sigla[nome] = sig
                print(f"✅ Loaded {len(rows)} provincia mappings into cache.")
    except Exception as e:
        print(f"⚠️ Failed to load provincia cache: {e}")

def expand_provinces(prov_list: List[str]) -> List[str]:
    expanded = set()
    for p in prov_list:
        clean_p = p.strip().upper()
        if not clean_p:
            continue
        expanded.add(clean_p)
        expanded.add(clean_p.lower())
        expanded.add(clean_p.capitalize())
        if clean_p in _provincia_cache_sigla_to_nome:
            for nome in _provincia_cache_sigla_to_nome[clean_p]:
                expanded.add(nome)
                expanded.add(nome.lower())
                expanded.add(nome.capitalize())
        if clean_p in _provincia_cache_nome_to_sigla:
            sig = _provincia_cache_nome_to_sigla[clean_p]
            expanded.add(sig)
            expanded.add(sig.lower())
            expanded.add(sig.capitalize())
    return list(expanded)

@app.on_event("startup")
async def startup_db():
    global db_pool
    try:
        os.makedirs(EXPORT_DIR, mode=0o700, exist_ok=True)
        asyncio.create_task(cleanup_old_exports())
        db_pool = await asyncpg.create_pool(DB_DSN, min_size=5, max_size=25, timeout=300.0, command_timeout=300.0)
        asyncio.create_task(load_comuni_cache())
        asyncio.create_task(load_provincia_cache())
        print("✅ PostgreSQL Connection Pool & Export Dir created successfully.")
    except Exception as e:
        print(f"⚠️ Failed to initialize startup: {e}")

@app.on_event("shutdown")
async def shutdown_db():
    global db_pool
    if db_pool:
        await db_pool.close()

@app.get("/api/tables")
async def get_tables():
    return {"tables": TABLES_METADATA}

@app.get("/api/comuni")
async def get_comuni(provincia: Optional[str] = None):
    global _comuni_cache
    if not _comuni_cache:
        await load_comuni_cache()
    if not _provincia_cache_sigla_to_nome:
        await load_provincia_cache()
    
    if provincia:
        prov_list = [p.strip().upper() for p in provincia.split(",") if p.strip()]
        if prov_list:
            expanded_upper = set(p.upper() for p in expand_provinces(prov_list))
            filtered = [c for c in _comuni_cache if c["prov"].upper() in expanded_upper]
            return {"comuni": filtered}
            
    return {"comuni": _comuni_cache}


class BlacklistAddRequest(BaseModel):
    type: str
    value: str
    reason: Optional[str] = "Aggiunto manualmente dall'operatore"
    force_add: Optional[bool] = False
    override: Optional[bool] = False

@app.get("/api/blacklist")
async def get_blacklist(
    limit: int = 100,
    offset: int = 0,
    q: Optional[str] = None,
    type: Optional[str] = None
):
    if not db_pool:
        return {"entries": [], "total": 0}
    entries = []
    total_mobile = 0
    total_email = 0
    async with db_pool.acquire() as conn:
        if type is None or type == "numero":
            if q:
                total_mobile = int(await conn.fetchval("SELECT COUNT(*) FROM blacklist_mobile WHERE cell ILIKE $1", "%" + q + "%", timeout=15.0))
            else:
                total_mobile = int(await conn.fetchval("SELECT COUNT(*) FROM blacklist_mobile", timeout=15.0))
        if type is None or type == "email":
            if q:
                total_email = int(await conn.fetchval("SELECT COUNT(*) FROM blacklist_email WHERE mail ILIKE $1", "%" + q + "%", timeout=15.0))
            else:
                total_email = int(await conn.fetchval("SELECT COUNT(*) FROM blacklist_email", timeout=15.0))
        mob_fetch = 0
        mob_off = offset
        email_fetch = 0
        email_off = 0
        if type == "numero":
            mob_fetch = limit
        elif type == "email":
            email_fetch = limit
            email_off = offset
        else:
            if mob_off < total_mobile:
                mob_fetch = min(limit, total_mobile - mob_off)
            remaining = limit - mob_fetch
            email_off = max(0, offset - total_mobile)
            if remaining > 0:
                email_fetch = remaining
        if mob_fetch > 0:
            if q:
                mobile_rows = await conn.fetch(
                    "SELECT cell as value FROM blacklist_mobile WHERE cell ILIKE $1 ORDER BY cell LIMIT $2 OFFSET $3",
                    "%" + q + "%", mob_fetch, mob_off, timeout=15.0
                )
            else:
                mobile_rows = await conn.fetch(
                    "SELECT cell as value FROM blacklist_mobile ORDER BY cell LIMIT $1 OFFSET $2",
                    mob_fetch, mob_off, timeout=15.0
                )
            for r in mobile_rows:
                entries.append({"id": "mob_" + r["value"], "type": "numero", "value": r["value"], "reason": "Blacklist Mobile DB", "addedAt": "In Database"})
        if email_fetch > 0:
            if q:
                email_rows = await conn.fetch(
                    "SELECT mail as value FROM blacklist_email WHERE mail ILIKE $1 ORDER BY mail LIMIT $2 OFFSET $3",
                    "%" + q + "%", email_fetch, email_off, timeout=15.0
                )
            else:
                email_rows = await conn.fetch(
                    "SELECT mail as value FROM blacklist_email ORDER BY mail LIMIT $1 OFFSET $2",
                    email_fetch, email_off, timeout=15.0
                )
            for r in email_rows:
                entries.append({"id": "em_" + r["value"], "type": "email", "value": r["value"], "reason": "Blacklist Email DB", "addedAt": "In Database"})
    return {"entries": entries, "total": total_mobile + total_email}


@app.post("/api/blacklist")
async def add_blacklist(req: BlacklistAddRequest):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database pool non ativo")
    
    clean_val = req.value.strip()
    is_mobile = req.type.strip().lower() in ("mobile", "numero", "prefisso", "cellulare", "cell", "phone", "tel")
    
    if is_mobile:
        import re
        clean_val = re.sub(r'^\+?39|^0039', '', clean_val)
        clean_val = re.sub(r'\D', '', clean_val)
        
        async with db_pool.acquire() as conn:
            # a) Hard Match (Exact Match)
            exact = await conn.fetchrow("SELECT cell FROM blacklist_mobile WHERE cell = $1", clean_val, timeout=15.0)
            if exact:
                return JSONResponse(
                    status_code=409,
                    content={
                        "status": "conflict",
                        "message": "Este valor já se encontra rigorosamente bloqueado na Blacklist."
                    }
                )
            
            # b) Soft Match (Similar Match)
            if not (req.force_add or req.override):
                conditions = []
                params = []
                param_idx = 1
                
                # shares the same last 7 digits
                if len(clean_val) >= 7:
                    suffix = clean_val[-7:]
                    conditions.append(f"cell LIKE '%' || ${param_idx}")
                    params.append(suffix)
                    param_idx += 1
                
                # has the same length but differs by exactly one digit
                patterns = [clean_val[:i] + '_' + clean_val[i+1:] for i in range(len(clean_val))]
                if patterns:
                    conditions.append(f"cell LIKE ANY(${param_idx}::text[])")
                    params.append(patterns)
                    param_idx += 1
                
                if conditions:
                    query = f"SELECT DISTINCT cell FROM blacklist_mobile WHERE " + " OR ".join(conditions)
                    similar_rows = await conn.fetch(query, *params, timeout=15.0)
                    similar_entries = [{"value": r["cell"]} for r in similar_rows]
                    if similar_entries:
                        return JSONResponse(
                            status_code=202,
                            content={
                                "status": "soft_match",
                                "message": "Encontramos entradas similares na Blacklist.",
                                "similar_entries": similar_entries
                            }
                        )
            
            # c) Override / Standard Insert
            await conn.execute(
                "INSERT INTO blacklist_mobile (cell) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM blacklist_mobile WHERE cell = $1)",
                clean_val,
                timeout=15.0
            )
    else:
        async with db_pool.acquire() as conn:
            # a) Hard Match (Exact Match)
            exact = await conn.fetchrow("SELECT mail FROM blacklist_email WHERE mail = $1", clean_val, timeout=15.0)
            if exact:
                return JSONResponse(
                    status_code=409,
                    content={
                        "status": "conflict",
                        "message": "Este valor já se encontra rigorosamente bloqueado na Blacklist."
                    }
                )
            
            # b) Soft Match (Similar Match)
            if not (req.force_add or req.override):
                similar_entries = []
                if "@" in clean_val:
                    domain = clean_val.split("@")[-1].strip()
                    if domain:
                        similar_rows = await conn.fetch(
                            "SELECT DISTINCT mail FROM blacklist_email WHERE mail ILIKE '%@' || $1",
                            domain,
                            timeout=15.0
                        )
                        similar_entries = [{"value": r["mail"]} for r in similar_rows]
                
                if similar_entries:
                    return JSONResponse(
                        status_code=202,
                        content={
                            "status": "soft_match",
                            "message": "Encontramos entradas similares na Blacklist.",
                            "similar_entries": similar_entries
                        }
                    )
            
            # c) Override / Standard Insert
            await conn.execute(
                "INSERT INTO blacklist_email (mail) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM blacklist_email WHERE mail = $1)",
                clean_val,
                timeout=15.0
            )
            
    return {"status": "ok", "value": clean_val}

@app.delete("/api/blacklist")
async def delete_blacklist(value: str = Query(...)):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database pool non attivo")
    async with db_pool.acquire() as conn:
        await conn.execute("DELETE FROM blacklist_mobile WHERE cell = $1", value, timeout=15.0)
        await conn.execute("DELETE FROM blacklist_email WHERE mail = $1", value, timeout=15.0)
    return {"status": "deleted", "value": value}


class SearchRequire(BaseModel):
    fixed: bool = False
    mobile: bool = False
    email: bool = False

class SearchPayload(BaseModel):
    table: str
    target: Optional[str] = "all" # "all" | "privati" | "aziende"
    channel: Optional[str] = "all" # "all" | "email" | "mobile" | "fixed"
    ageMin: Optional[int] = None
    ageMax: Optional[int] = None
    sesso: Optional[str] = "" # "M" | "F" | ""
    categoria: Optional[str] = ""
    q: Optional[str] = ""
    mode: str = "exact"  # "exact" | "fuzzy"
    cf: Optional[str] = ""
    pi: Optional[str] = ""
    comune: Optional[str] = ""
    provincia: Optional[str] = ""
    regione: Optional[str] = ""
    cap: Optional[str] = ""
    require: Optional[SearchRequire] = SearchRequire()
    blacklist: bool = True
    onlyItalians: bool = False
    origineEtnica: Optional[str] = ""
    secondaGenerazione: Optional[bool] = False
    page: int = Field(default=1, ge=1)
    pageSize: int = Field(default=100, ge=1, le=1000)
    format: Optional[str] = "xlsx" # "xlsx" | "csv" | "zip" | "xlsx_split"
    exportName: Optional[str] = None # Optional reference name for export file
    suppressList: Optional[List[str]] = None
    suppressType: Optional[str] = "auto"
    suppressFileName: Optional[str] = None
    strictNameFilter: Optional[bool] = False
    isVillette: Optional[bool] = False
    hasAzienda: Optional[bool] = False

def build_query(payload: SearchPayload, is_count: bool = False):
    table_alias_map = {
        "global": "privati_2023",
        "unified": "privati_2023",
        "persone": "privati_2023",
        "imprese": "aziende_2023",
        "professionisti": "aziende_fissi_2025_completo",
        "catasto": "nord_totale",
    }
    if payload.table in table_alias_map:
        payload.table = table_alias_map[payload.table]

    if payload.target in ("privati", "all") or (payload.table in ("privati_2023", "nord_totale", "censud_totale", "nord_censud_union") and payload.channel == "mobile"):
        if payload.channel == "email":
            payload.table = "email_privati"
        elif payload.channel == "mobile":
            nord_provs = {'AL','AT','BI','CN','NO','TO','VB','VC','AO','GE','IM','SP','SV','BG','BS','CO','CR','LC','LO','MN','MI','MB','PV','SO','VA','BZ','TN','BL','PD','RO','TV','VE','VR','VI','GO','PN','TS','UD','BO','FE','FC','MO','PR','RA','RE','RN','PC','ALESSANDRIA','ASTI','BIELLA','CUNEO','NOVARA','TORINO','VERBANO-CUSIO-OSSOLA','VERCELLI','AOSTA','GENOVA','IMPERIA','LA SPEZIA','SAVONA','BERGAMO','BRESCIA','COMO','CREMONA','LECCO','LODI','MANTOVA','MILANO','MONZA E DELLA BRIANZA','PAVIA','SONDRIO','VARESE','BOLZANO','TRENTO','BELLUNO','PADOVA','ROVIGO','TREVISO','VENEZIA','VERONA','VICENZA','GORIZIA','PORDENONE','TRIESTE','UDINE','BOLOGNA','FERRARA','FORLÌ-CESENA','MODENA','PARMA','RAVENNA','REGGIO EMILIA','RIMINI','PIACENZA'}
            nord_regions = {'nord', 'lombardia', 'veneto', 'piemonte', 'emilia', 'emilia-romagna', 'emilia romagna', 'liguria', 'friuli', 'friuli-venezia giulia', 'friuli venezia giulia', 'trentino', 'trentino-alto adige', 'trentino alto adige', 'valledaosta', "valle d'aosta", 'valle aosta', "val d'aosta", 'aosta'}
            has_nord = False
            has_sud = False
            if payload.provincia:
                provs = [p.strip().upper() for p in payload.provincia.replace(';', ',').split(',') if p.strip()]
                provs_expanded_upper = set(p.upper() for p in expand_provinces(provs))
                has_nord = any(p in nord_provs for p in provs_expanded_upper)
                has_sud = any(p not in nord_provs for p in provs_expanded_upper)
            elif payload.regione:
                regs = [r.strip().lower() for r in payload.regione.replace(';', ',').split(',') if r.strip()]
                has_nord = any(r in nord_regions for r in regs)
                has_sud = any(r not in nord_regions for r in regs)
            elif payload.comune and _comuni_cache:
                cities = [c.strip().lower() for c in payload.comune.replace(';', ',').split(',') if c.strip()]
                matching_provs = []
                for city in cities:
                    matching_provs.extend([item["prov"] for item in _comuni_cache if item["name"].lower().startswith(city)])
                if matching_provs:
                    has_nord = any(p in nord_provs for p in matching_provs)
                    has_sud = any(p not in nord_provs for p in matching_provs)
                else:
                    has_nord = True
                    has_sud = True
            elif payload.table == "nord_totale":
                has_nord = True
            elif payload.table == "censud_totale":
                has_sud = True
            else:
                has_nord = True
                has_sud = True

            if has_nord and has_sud:
                payload.table = "nord_censud_union"
            elif has_nord:
                payload.table = "nord_totale"
            else:
                payload.table = "censud_totale"
        elif payload.channel == "fixed":
            payload.table = "privati_2023"
            if payload.require: payload.require.fixed = True
        else:
            if payload.target in ("privati", "all"):
                payload.table = "privati_unified"
    elif payload.target == "aziende":
        if payload.channel == "mobile":
            payload.table = "aziende_cell_tot_glob_verificate_2023"
        elif payload.channel == "fixed":
            payload.table = "aziende_fissi_2025_completo"
        else:
            payload.table = "aziende_2023"

    if getattr(payload, "isVillette", False):
        payload.table = "villette_official_ago_26"

    table = payload.table
    if not any(t["id"] == table for t in TABLES_METADATA) and table not in ("nord_censud_union", "privati_unified"):
        raise HTTPException(status_code=400, detail="Invalid table name")

    if table == "privati_unified" or table == "nord_censud_union":
        cols = ["cognome", "nome", "nominativo", "codice_fiscale", "indirizzo", "comune", "provincia", "cap", "cellulare", "numtelcompl", "email", "annon", "sesso", "origine_etnica", "seconda_generazione"]
    else:
        table_meta = next(t for t in TABLES_METADATA if t["id"] == table)
        cols = table_meta["columns"]

    where_clauses = ["1=1"]
    params = []
    param_idx = 1

    if payload.q:
        q_term = payload.q.strip()
        text_cols = [c for c in cols if c in ("cognome", "nome", "cognome_clean", "nome_clean", "nominativo", "cognome_e_nome", "ragione_sociale", "rag_soc", "ragsociale", "rgs", "indirizzo", "via", "email", "mail")]
        if text_cols:
            sub_clauses = [f"{c} ILIKE ${param_idx}" for c in text_cols]
            where_clauses.append("(" + " OR ".join(sub_clauses) + ")")
            params.append(f"%{q_term}%" if payload.mode == "fuzzy" else f"{q_term}%")
            param_idx += 1

    if payload.cf:
        cf_cols = [c for c in cols if c in ("codice_fiscale", "cf")]
        if cf_cols:
            where_clauses.append(f"{cf_cols[0]} ILIKE ${param_idx}")
            params.append(f"{payload.cf.strip().upper()}%")
            param_idx += 1

    if payload.pi:
        pi_cols = [c for c in cols if c in ("partita_iva", "pi", "iva")]
        if pi_cols:
            where_clauses.append(f"{pi_cols[0]} LIKE ${param_idx}")
            params.append(f"{payload.pi.strip()}%")
            param_idx += 1

    if payload.comune:
        city_cols = [c for c in cols if c in ("comune", "citta", "localita")]
        if city_cols:
            cities = [c.strip() for c in payload.comune.replace(';', ',').split(',') if c.strip()]
            if len(cities) == 1:
                where_clauses.append(f"{city_cols[0]} ILIKE ${param_idx}")
                params.append(f"{cities[0]}%")
                param_idx += 1
            elif len(cities) > 1:
                sub_clauses = [f"{city_cols[0]} ILIKE ${param_idx + i}" for i in range(len(cities))]
                where_clauses.append("(" + " OR ".join(sub_clauses) + ")")
                for c in cities:
                    params.append(f"{c}%")
                    param_idx += 1

    prov_cols = [c for c in cols if c in ("provincia", "prov")]
    if payload.provincia and prov_cols:
        provs = [p.strip().upper() for p in payload.provincia.replace(';', ',').split(',') if p.strip()]
        if provs:
            expanded_p = expand_provinces(provs)
            if expanded_p:
                placeholders_p = ', '.join([f"${param_idx + i}" for i in range(len(expanded_p))])
                sub_clauses = [f"{prov_cols[0]} IN ({placeholders_p})"]
                for ep in expanded_p:
                    params.append(ep)
                param_idx += len(expanded_p)
                where_clauses.append("(" + " OR ".join(sub_clauses) + ")")

    if payload.cap and "cap" in cols:
        caps = [c.strip() for c in payload.cap.replace(';', ',').split(',') if c.strip()]
        if len(caps) == 1:
            where_clauses.append(f"cap LIKE ${param_idx}")
            params.append(f"{caps[0]}%")
            param_idx += 1
        elif len(caps) > 1:
            sub_clauses = [f"cap LIKE ${param_idx + i}" for i in range(len(caps))]
            where_clauses.append("(" + " OR ".join(sub_clauses) + ")")
            for c in caps:
                params.append(f"{c}%")
                param_idx += 1

    if payload.regione and prov_cols:
        regs = [r.strip().lower() for r in payload.regione.replace(';', ',').split(',') if r.strip()]
        region_map = {
            'nord': ['AL','AT','BI','CN','NO','TO','VB','VC','AO','GE','IM','SP','SV','BG','BS','CO','CR','LC','LO','MN','MI','MB','PV','SO','VA','BZ','TN','BL','PD','RO','TV','VE','VR','VI','GO','PN','TS','UD','BO','FE','FC','MO','PR','RA','RE','RN','PC'],
            'centro': ['AR','FI','GR','LI','LU','MS','PI','PT','PO','SI','PG','TR','AN','AP','FM','MC','PU','FR','LT','RI','RM','VT'],
            'sud': ['CH','AQ','PE','TE','CB','IS','AV','BN','CE','NA','SA','BA','BT','BR','FG','LE','TA','MT','PZ','CZ','CS','KR','RC','VV','AG','CL','CT','EN','ME','PA','RG','SR','TP','CA','NU','OR','SS','SU'],
            'lombardia': ['BG','BS','CO','CR','LC','LO','MN','MI','MB','PV','SO','VA'],
            'lazio': ['FR','LT','RI','RM','VT'],
            'veneto': ['BL','PD','RO','TV','VE','VR','VI'],
            'campania': ['AV','BN','CE','NA','SA'],
            'emilia': ['BO','FE','FC','MO','PR','RA','RE','RN','PC'],
            'emilia-romagna': ['BO','FE','FC','MO','PR','RA','RE','RN','PC'],
            'piemonte': ['AL','AT','BI','CN','NO','TO','VB','VC'],
            'sicilia': ['AG','CL','CT','EN','ME','PA','RG','SR','TP'],
            'puglia': ['BA','BT','BR','FG','LE','TA'],
            'toscana': ['AR','FI','GR','LI','LU','MS','PI','PT','PO','SI'],
            'calabria': ['CZ','CS','KR','RC','VV'],
            'sardegna': ['CA','NU','OR','SS','SU'],
            'liguria': ['GE','IM','SP','SV'],
            'marche': ['AN','AP','FM','MC','PU'],
            'abruzzo': ['CH','AQ','PE','TE'],
            'friuli': ['GO','PN','TS','UD'],
            'friuli-venezia giulia': ['GO','PN','TS','UD'],
            'trentino': ['BZ','TN'],
            'trentino-alto adige': ['BZ','TN'],
            'umbria': ['PG','TR'],
            'basilicata': ['MT','PZ'],
            'molise': ['CB','IS'],
            'valledaosta': ['AO'],
            'valle d\'aosta': ['AO'],
            'aosta': ['AO'],
            'trentino alto adige': ['BZ','TN'],
            'friuli venezia giulia': ['GO','PN','TS','UD'],
            'emilia romagna': ['BO','FE','FC','MO','PR','RA','RE','RN','PC'],
            'valle aosta': ['AO'],
            "val d'aosta": ['AO']
        }
        all_provs = []
        for reg in regs:
            if reg in region_map:
                all_provs.extend(region_map[reg])
        all_provs = sorted(list(set(all_provs)))
        if all_provs:
            expanded_all = expand_provinces(all_provs)
            if expanded_all:
                placeholders = ', '.join([f"${param_idx + i}" for i in range(len(expanded_all))])
                where_clauses.append(f"{prov_cols[0]} IN ({placeholders})")
                for p in expanded_all:
                    params.append(p)
                    param_idx += 1

    annon_cols = [c for c in cols if c in ("annon", "anno_nascita", "anno")]
    if (payload.ageMin or payload.ageMax) and annon_cols:
        col = annon_cols[0]
        curr_year = 2026
        if payload.ageMin and payload.ageMax:
            amin = min(payload.ageMin, payload.ageMax)
            amax = max(payload.ageMin, payload.ageMax)
            min_year = str(curr_year - amax)
            max_year = str(curr_year - amin)
            where_clauses.append(f"({col} >= '{min_year}' AND {col} <= '{max_year}')")
        elif payload.ageMin:
            max_year = str(curr_year - payload.ageMin)
            where_clauses.append(f"({col} <= '{max_year}' AND {col} >= '1900')")
        elif payload.ageMax:
            min_year = str(curr_year - payload.ageMax)
            where_clauses.append(f"({col} >= '{min_year}' AND {col} <= '{curr_year}')")

    sesso_cols = [c for c in cols if c in ("sesso", "sex", "genere")]
    if payload.sesso and sesso_cols:
        where_clauses.append(f"{sesso_cols[0]} ILIKE ${param_idx}")
        params.append(f"{payload.sesso.strip().upper()}%")
        param_idx += 1

    if payload.onlyItalians:
        cf_cols = [c for c in cols if c in ("codice_fiscale", "cf")]
        if cf_cols:
            where_clauses.append(f"({cf_cols[0]} IS NOT NULL AND {cf_cols[0]} != '' AND LENGTH({cf_cols[0]}) >= 12 AND SUBSTRING({cf_cols[0]}, 12, 1) NOT IN ('Z', 'z'))")
        else:
            where_clauses.append("1=0")

    surname_col = next((c for c in cols if c in ("cognome", "cognome_e_nome", "nominativo", "ragsociale", "ragione_sociale", "rgs")), None)
    if payload.origineEtnica and surname_col:
        etnia_val = payload.origineEtnica.strip().upper()
        if etnia_val and etnia_val != "TUTTI":
            where_clauses.append(f"({surname_col} IN (SELECT raw_text FROM onomastic_mapping WHERE origine_etnica = ${param_idx}) OR {surname_col} IN (SELECT cognome_clean FROM onomastic_mapping WHERE origine_etnica = ${param_idx}) OR SPLIT_PART({surname_col}, ' ', 1) IN (SELECT cognome_clean FROM onomastic_mapping WHERE origine_etnica = ${param_idx}))")
            params.append(etnia_val)
            param_idx += 1

    if payload.secondaGenerazione and surname_col:
        cf_cols = [c for c in cols if c in ("codice_fiscale", "cf")]
        if cf_cols:
            where_clauses.append(f"({cf_cols[0]} IS NOT NULL AND {cf_cols[0]} != '' AND LENGTH({cf_cols[0]}) >= 16 AND SUBSTRING({cf_cols[0]}, 12, 1) NOT IN ('Z', 'z'))")
            where_clauses.append(f"({surname_col} IN (SELECT raw_text FROM onomastic_mapping WHERE origine_etnica NOT IN ('ITALIANO', 'ALTRO_ESTERO')) OR {surname_col} IN (SELECT cognome_clean FROM onomastic_mapping WHERE origine_etnica NOT IN ('ITALIANO', 'ALTRO_ESTERO')) OR SPLIT_PART({surname_col}, ' ', 1) IN (SELECT cognome_clean FROM onomastic_mapping WHERE origine_etnica NOT IN ('ITALIANO', 'ALTRO_ESTERO')))")
        else:
            where_clauses.append("1=0")

    cat_cols = [c for c in cols if c in ("categoria", "codiceateco", "settore", "cat")]
    if payload.categoria and cat_cols:
        cats = [c.strip() for c in payload.categoria.replace(';', ',').split(',') if c.strip()]
        if len(cats) == 1:
            where_clauses.append(f"{cat_cols[0]} ILIKE ${param_idx}")
            params.append(f"%{cats[0]}%")
            param_idx += 1
        elif len(cats) > 1:
            sub_clauses = [f"{cat_cols[0]} ILIKE ${param_idx + i}" for i in range(len(cats))]
            where_clauses.append("(" + " OR ".join(sub_clauses) + ")")
            for c in cats:
                params.append(f"%{c}%")
                param_idx += 1

    if payload.require:
        if payload.require.fixed:
            tel_cols = [c for c in cols if c in ("telefono", "numtelcompl", "tel")]
            if tel_cols:
                where_clauses.append(f"({tel_cols[0]} IS NOT NULL AND {tel_cols[0]} != '')")
        if payload.require.mobile:
            mob_cols = [c for c in cols if c in ("cellulare", "numtelcompl")]
            if mob_cols:
                if mob_cols[0] == "numtelcompl":
                    where_clauses.append(f"({mob_cols[0]} IS NOT NULL AND {mob_cols[0]} != '' AND {mob_cols[0]} ~ '^[+\-0-9]*3[0-9]{{8,10}}')")
                else:
                    where_clauses.append(f"({mob_cols[0]} IS NOT NULL AND {mob_cols[0]} != '')")
        if payload.require.email:
            em_cols = [c for c in cols if c in ("email", "mail")]
            if em_cols:
                where_clauses.append(f"({em_cols[0]} IS NOT NULL AND {em_cols[0]} != '')")

    if payload.blacklist and table not in ("blacklist_email", "blacklist_mobile"):
        if "email" in cols or "mail" in cols:
            em_col = "email" if "email" in cols else "mail"
            where_clauses.append(f"NOT EXISTS (SELECT 1 FROM blacklist_email b WHERE b.mail = {table}.{em_col})")
        if "cellulare" in cols or "cell" in cols:
            cell_col = "cellulare" if "cellulare" in cols else "cell"
            where_clauses.append(f"NOT EXISTS (SELECT 1 FROM blacklist_mobile bm WHERE bm.cell = {table}.{cell_col})")

    if payload.suppressList:
        clean_suppress = [str(s).strip() for s in set(payload.suppressList) if str(s).strip()]
        if clean_suppress:
            target_cols = [c for c in cols if c in ("cellulare", "numtelcompl", "telefono", "tel", "email", "mail", "codice_fiscale", "cf")]
            if target_cols:
                if len(clean_suppress) <= 500:
                    sub_conds = [f"({c} IS NULL OR NOT ({c} = ANY(${param_idx})))" for c in target_cols]
                    where_clauses.append("(" + " AND ".join(sub_conds) + ")")
                    params.append(clean_suppress)
                    param_idx += 1
                else:
                    where_clauses.append(f"NOT EXISTS (SELECT 1 FROM temp_suppress_list ts WHERE {or_conds})")

    if getattr(payload, "strictNameFilter", False):
        surname_col = next((c for c in cols if c in ("cognome", "cognome_e_nome", "nominativo", "ragsociale", "rag_soc", "rgs")), None)
        cf_cols = [c for c in cols if c in ("codice_fiscale", "cf", "partita_iva", "pi", "iva")]
        if surname_col and cf_cols:
            w_cond = f"NOT ( ({cf_cols[0]} IS NULL OR TRIM({cf_cols[0]}) = '') AND ({surname_col} ~* '[wyjkxh]' OR {surname_col} ~* 'u$') )"
            where_clauses.append(w_cond)

    if getattr(payload, "hasAzienda", False):
        if table in ("nord_totale", "censud_totale", "privati_2023", "nord_censud_union", "privati_unified"):
            where_clauses.append("has_azienda = TRUE")

    where_sql = " AND ".join(where_clauses)

    if table == "privati_unified":
        # Universal UNION: nord_totale + censud_totale + privati_2023
        # Wrap the UNION ALL in a subquery so that we can filter on the canonical projected columns
        # (e.g. cellulare, sesso, email) which might not exist in the underlying base tables.
        proj_nord = CANONICAL_PROJECTIONS.get("nord_totale", "*")
        proj_sud = CANONICAL_PROJECTIONS.get("censud_totale", "*")
        proj_priv = CANONICAL_PROJECTIONS.get("privati_2023", "*")
        
        # Remove table qualifications from where_sql since we are querying the wrapper 'u'
        w_unified = where_sql.replace("privati_unified.", "").replace("has_azienda = TRUE", "impresa = 'Sì'")
        
        if is_count:
            sql = f"""SELECT count(*) FROM (
                (SELECT {proj_nord} FROM nord_totale)
                UNION ALL
                (SELECT {proj_sud} FROM censud_totale)
                UNION ALL
                (SELECT {proj_priv} FROM privati_2023)
            ) AS u WHERE {w_unified}"""
        else:
            offset = (payload.page - 1) * payload.pageSize
            sql = f"""SELECT * FROM (
                (SELECT {proj_nord} FROM nord_totale)
                UNION ALL
                (SELECT {proj_sud} FROM censud_totale)
                UNION ALL
                (SELECT {proj_priv} FROM privati_2023)
            ) AS u WHERE {w_unified} LIMIT {payload.pageSize} OFFSET {offset}"""
    elif table == "nord_censud_union":
        w_nord = where_sql.replace("nord_censud_union.", "nord_totale.")
        w_sud = where_sql.replace("nord_censud_union.", "censud_totale.")
        if is_count:
            sql = f"SELECT (SELECT count(*) FROM nord_totale WHERE {w_nord}) + (SELECT count(*) FROM censud_totale WHERE {w_sud})"
        else:
            offset = (payload.page - 1) * payload.pageSize
            proj_nord = CANONICAL_PROJECTIONS.get("nord_totale", "*")
            proj_sud = CANONICAL_PROJECTIONS.get("censud_totale", "*")
            sql = f"SELECT * FROM ((SELECT {proj_nord} FROM nord_totale WHERE {w_nord}) UNION ALL (SELECT {proj_sud} FROM censud_totale WHERE {w_sud})) AS u LIMIT {payload.pageSize} OFFSET {offset}"
    elif is_count:
        sql = f"SELECT count(*) FROM {table} WHERE {where_sql}"
    else:
        offset = (payload.page - 1) * payload.pageSize
        proj = CANONICAL_PROJECTIONS.get(table, "*")
        sql = f"SELECT {proj} FROM {table} WHERE {where_sql} LIMIT {payload.pageSize} OFFSET {offset}"

    return sql, params

@app.post("/api/search", dependencies=[Depends(verify_auth_token)])
async def search_records(payload: SearchPayload):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database pool not initialized")

    if payload.page * payload.pageSize > 5000:
        raise HTTPException(status_code=400, detail="Limite de visualização online atingido (máx. 5.000 registros por pesquisa). Utilize a ferramenta de Exportação para volumes maiores.")

    if payload.table in ("global", "privati_2023", "nord_totale", "censud_totale", "nord_censud_union", "privati_unified"):
        has_filter = any([
            payload.q and payload.q.strip(),
            payload.regione and payload.regione.strip(),
            payload.provincia and payload.provincia.strip(),
            payload.comune and payload.comune.strip(),
            payload.categoria and payload.categoria.strip(),
            payload.sesso and payload.sesso.strip(),
            payload.ageMin is not None,
            payload.ageMax is not None,
            payload.cf and payload.cf.strip(),
            payload.pi and payload.pi.strip(),
            payload.onlyItalians,
            payload.require and (payload.require.fixed or payload.require.mobile or payload.require.email)
        ])
        if not has_filter:
            return {
                "rows": [],
                "total": 0,
                "elapsedMs": 0,
                "columns": ["tabella", "cognome_o_ragione", "nome", "codice_fiscale_o_piva", "comune", "provincia", "telefono"],
                "warning": "Nenhum filtro de pesquisa fornecido."
            }

    start_time = time.time()
    try:
        count_sql, count_params = build_query(payload, is_count=True)
        data_sql, data_params = build_query(payload, is_count=False)

        async with db_pool.acquire() as conn:
            async with conn.transaction():
                if payload.suppressList and len(payload.suppressList) > 500:
                    await conn.execute("CREATE TEMP TABLE IF NOT EXISTS temp_suppress_list (contact TEXT PRIMARY KEY) ON COMMIT DROP;", timeout=300.0)
                    await conn.execute("TRUNCATE TABLE temp_suppress_list;", timeout=300.0)
                    clean_items = [(str(s).strip(),) for s in set(payload.suppressList) if str(s).strip()]
                    await conn.copy_records_to_table('temp_suppress_list', records=clean_items, timeout=300.0)
                total = await conn.fetchval(count_sql, *count_params, timeout=300.0)
                rows = await conn.fetch(data_sql, *data_params, timeout=300.0)

        elapsed_ms = int((time.time() - start_time) * 1000)
        if rows:
            columns = list(dict(rows[0]).keys())
        elif payload.table == "global":
            columns = ["tabella", "cognome_o_ragione", "nome", "codice_fiscale_o_piva", "comune", "provincia", "telefono"]
        elif payload.table in ("nord_censud_union", "privati_unified"):
            columns = ["cognome", "nome", "nominativo", "codice_fiscale", "indirizzo", "comune", "provincia", "cap", "cellulare", "numtelcompl", "email", "annon", "sesso", "origine_etnica", "seconda_generazione"]
        else:
            table_meta = next((t for t in TABLES_METADATA if t["id"] == payload.table), None)
            columns = table_meta["columns"] if table_meta else []

        def clean_record(rec):
            d = dict(rec)
            for k, v in d.items():
                if k in ("provincia", "prov") and isinstance(v, str):
                    upper_v = v.strip().upper()
                    if upper_v in _provincia_cache_nome_to_sigla:
                        v = _provincia_cache_nome_to_sigla[upper_v]
                d[k] = clean_error_string(v)
            return d

        return {
            "rows": [clean_record(r) for r in rows],
            "total": total or 0,
            "elapsedMs": elapsed_ms,
            "columns": columns
        }
    except HTTPException:
        raise
    except (asyncio.TimeoutError, asyncpg.exceptions.QueryCanceledError):
        raise HTTPException(status_code=408, detail="Tempo limite de consulta atingido (300 segundos). Por favor, refina seus filtros para uma busca mais rápida.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao processar a consulta no servidor.")

async def run_export_background(job_id: str, payload: SearchPayload):
    try:
        export_jobs[job_id]["pct"] = 10
        export_jobs[job_id]["rowsProcessed"] = 0
        export_jobs[job_id]["rowsPerSec"] = 5000

        # Simulate or run real export    try:
        data_sql, data_params = build_query(payload, is_count=False)
        export_sql = data_sql.split(" LIMIT ")[0]
        
        import re, csv, io, time, os
        ext = payload.format if payload.format in ("xlsx", "csv", "zip", "xlsx_split") else "csv"
        
        if payload.exportName and payload.exportName.strip():
            clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', payload.exportName.strip())
            file_name = clean_name if clean_name.lower().endswith(f".{ext}") else f"{clean_name}.{ext}"
        else:
            file_name = f"export_{payload.table}_{int(time.time())}.{ext}"
            
        file_path = os.path.join(EXPORT_DIR, file_name)
        
        export_jobs[job_id]["pct"] = 15
        export_jobs[job_id]["rowsProcessed"] = 0

        async with db_pool.acquire() as conn:
            async with conn.transaction():
                if payload.suppressList and len(payload.suppressList) > 500:
                    await conn.execute("CREATE TEMP TABLE IF NOT EXISTS temp_suppress_list (contact TEXT PRIMARY KEY) ON COMMIT DROP;")
                    await conn.execute("TRUNCATE TABLE temp_suppress_list;")
                    clean_items = [(str(s).strip(),) for s in set(payload.suppressList) if str(s).strip()]
                    await conn.copy_records_to_table('temp_suppress_list', records=clean_items)

                write_start_time = time.time()
                total_processed = 0
                
                if ext == "xlsx":
                    import xlsxwriter
                    workbook = xlsxwriter.Workbook(file_path, {'constant_memory': True})
                    worksheet = None
                    chunk_size = 100000
                    
                    async for record in conn.cursor(export_sql, *data_params, prefetch=20000):
                        if total_processed == 0:
                            headers = list(record.keys())
                            worksheet = workbook.add_worksheet("Dati Export 1")
                            for col_idx, h in enumerate(headers):
                                worksheet.write_string(0, col_idx, str(h))
                                
                        if total_processed > 0 and total_processed % chunk_size == 0:
                            part_num = (total_processed // chunk_size) + 1
                            worksheet = workbook.add_worksheet(f"Dati Export {part_num}")
                            for col_idx, h in enumerate(headers):
                                worksheet.write_string(0, col_idx, str(h))

                        row_idx = (total_processed % chunk_size) + 1
                        row_vals = []
                        for h in headers:
                            val = record[h]
                            if val is not None:
                                if h in ("provincia", "prov") and isinstance(val, str):
                                    upper_v = val.strip().upper()
                                    if upper_v in _provincia_cache_nome_to_sigla:
                                        val = _provincia_cache_nome_to_sigla[upper_v]
                            row_vals.append(clean_error_string(str(val)) if val is not None else "")
                        worksheet.write_row(row_idx, 0, row_vals)
                            
                        total_processed += 1
                        if total_processed % 1000 == 0:
                            elapsed_w = time.time() - write_start_time
                            export_jobs[job_id]["rowsProcessed"] = total_processed
                            export_jobs[job_id]["rowsPerSec"] = int(total_processed / max(0.001, elapsed_w))
                            export_jobs[job_id]["pct"] = int(15 + min(83, (total_processed / max(1, 1000000)) * 83))

                    if total_processed == 0:
                        worksheet = workbook.add_worksheet("Dati Export")
                        worksheet.write_string(0, 0, "Nessun dato trovato")
                    workbook.close()

                elif ext == "xlsx_split":
                    import zipfile
                    try: import xlsxwriter
                    except: pass
                    zip_filename = file_name.replace(".xlsx_split", ".zip").replace(".xlsx", ".zip")
                    zip_path = os.path.join(EXPORT_DIR, zip_filename)
                    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                        chunk_size = 1000000
                        current_workbook = None
                        current_worksheet = None
                        current_part_path = None
                        current_part_name = None
                        headers = None

                        async for record in conn.cursor(export_sql, *data_params, prefetch=20000):
                            if total_processed == 0:
                                headers = list(record.keys())

                            if total_processed % chunk_size == 0:
                                if current_workbook:
                                    current_workbook.close()
                                    zf.write(current_part_path, current_part_name)
                                    import os as os_mod
                                    os_mod.remove(current_part_path)

                                part_num = (total_processed // chunk_size) + 1
                                current_part_name = file_name.replace(".xlsx_split", "").replace(".xlsx", "") + f"_parte{part_num}.xlsx"
                                current_part_path = f"/tmp/{current_part_name}"
                                current_workbook = xlsxwriter.Workbook(current_part_path, {'constant_memory': True})
                                current_worksheet = current_workbook.add_worksheet(f"Parte {part_num}")
                                for col_idx, h in enumerate(headers):
                                    current_worksheet.write_string(0, col_idx, str(h))

                        
                            row_idx = (total_processed % chunk_size) + 1
                            row_vals = []
                        for h in headers:
                            val = record[h]
                            if val is not None:
                                if h in ("provincia", "prov") and isinstance(val, str):
                                    upper_v = val.strip().upper()
                                    if upper_v in _provincia_cache_nome_to_sigla:
                                        val = _provincia_cache_nome_to_sigla[upper_v]
                            row_vals.append(clean_error_string(str(val)) if val is not None else "")
                            current_worksheet.write_row(row_idx, 0, row_vals)
                                
                            total_processed += 1
                            if total_processed % 1000 == 0:
                                elapsed_w = time.time() - write_start_time
                                export_jobs[job_id]["rowsProcessed"] = total_processed
                                export_jobs[job_id]["rowsPerSec"] = int(total_processed / max(0.001, elapsed_w))
                                export_jobs[job_id]["pct"] = int(15 + min(83, (total_processed / max(1, 1000000)) * 83))

                        if current_workbook:
                            current_workbook.close()
                            zf.write(current_part_path, current_part_name)
                            import os as os_mod
                            os_mod.remove(current_part_path)

                        if total_processed == 0:
                            part_path = f"/tmp/empty.xlsx"
                            workbook = xlsxwriter.Workbook(part_path)
                            worksheet = workbook.add_worksheet("Dati Export")
                            worksheet.write_string(0, 0, "Nessun dato trovato")
                            workbook.close()
                            zf.write(part_path, "empty.xlsx")
                            import os as os_mod
                            os_mod.remove(part_path)
                            
                    file_path = zip_path
                    file_name = zip_filename

                elif ext == "zip":
                    import zipfile
                    csv_filename = file_name.replace(".zip", ".csv")
                    with zipfile.ZipFile(file_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                        with open(f"/tmp/temp_{job_id}.csv", "w", newline="", encoding="utf-8") as f:
                            writer = csv.writer(f, delimiter=';')
                            headers = None
                            async for record in conn.cursor(export_sql, *data_params, prefetch=20000):
                                if total_processed == 0:
                                    headers = list(record.keys())
                                    writer.writerow(headers)
                                row_vals = []
                                for h in headers:
                                    val = record[h]
                                    if val is not None:
                                        if h in ("provincia", "prov") and isinstance(val, str):
                                            upper_v = val.strip().upper()
                                            if upper_v in _provincia_cache_nome_to_sigla:
                                                val = _provincia_cache_nome_to_sigla[upper_v]
                                    row_vals.append(clean_error_string(str(val)) if val is not None else "")
                                writer.writerow(row_vals)
                                total_processed += 1
                                if total_processed % 2000 == 0:
                                    elapsed_w = time.time() - write_start_time
                                    export_jobs[job_id]["rowsProcessed"] = total_processed
                                    export_jobs[job_id]["rowsPerSec"] = int(total_processed / max(0.001, elapsed_w))
                                    export_jobs[job_id]["pct"] = int(15 + min(83, (total_processed / max(1, 1000000)) * 83))
                            if total_processed == 0:
                                f.write("Nessun dato trovato\n")
                        zf.write(f"/tmp/temp_{job_id}.csv", csv_filename)
                        os.remove(f"/tmp/temp_{job_id}.csv")

                else:
                    with open(file_path, "w", newline="", encoding="utf-8") as f:
                        writer = csv.writer(f, delimiter=';')
                        headers = None
                        async for record in conn.cursor(export_sql, *data_params, prefetch=20000):
                            if total_processed == 0:
                                headers = list(record.keys())
                                writer.writerow(headers)
                            row_vals = []
                            for h in headers:
                                val = record[h]
                                if val is not None:
                                    if h in ("provincia", "prov") and isinstance(val, str):
                                        upper_v = val.strip().upper()
                                        if upper_v in _provincia_cache_nome_to_sigla:
                                            val = _provincia_cache_nome_to_sigla[upper_v]
                                row_vals.append(clean_error_string(str(val)) if val is not None else "")
                            writer.writerow(row_vals)
                            total_processed += 1
                            if total_processed % 2000 == 0:
                                elapsed_w = time.time() - write_start_time
                                export_jobs[job_id]["rowsProcessed"] = total_processed
                                export_jobs[job_id]["rowsPerSec"] = int(total_processed / max(0.001, elapsed_w))
                                export_jobs[job_id]["pct"] = int(15 + min(83, (total_processed / max(1, 1000000)) * 83))
                        if total_processed == 0:
                            f.write("Nessun dato trovato\n")

        file_size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)
        export_jobs[job_id]["rowsProcessed"] = total_processed
        export_jobs[job_id]["pct"] = 100
        export_jobs[job_id]["downloadUrl"] = f"/api/download/{file_name}"
        export_jobs[job_id]["fileSize"] = f"{file_size_mb} MB" if file_size_mb > 0 else "12 KB"

    except Exception as e:
        import traceback
        traceback.print_exc()
        export_jobs[job_id]["pct"] = -1
        export_jobs[job_id]["error"] = "Erro interno ao gerar a exportação."

@app.post("/api/export", dependencies=[Depends(verify_auth_token)])
async def start_export(payload: SearchPayload, background_tasks: BackgroundTasks):
    count_sql, count_params = build_query(payload, is_count=True)
    async with db_pool.acquire() as conn:
        total = await conn.fetchval(count_sql, *count_params, timeout=120.0)
    
    # Limite físico do Excel removido (agora divide em abas a cada 100k)
    job_id = str(uuid.uuid4())
    export_jobs[job_id] = {
        "pct": 0,
        "rowsProcessed": 0,
        "rowsPerSec": 0,
        "downloadUrl": None,
        "fileSize": None
    }
    background_tasks.add_task(run_export_background, job_id, payload)
    return {"jobId": job_id}

@app.post("/api/comune_summary", dependencies=[Depends(verify_auth_token)])
async def comune_summary(payload: SearchPayload):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database pool not initialized")
    
    _, _ = build_query(payload, is_count=False)
    data_sql, data_params = build_query(payload, is_count=False)
    base_sql = data_sql.split(" LIMIT ")[0]
    
    cols = []
    if payload.table in ("nord_censud_union", "privati_unified"):
        cols = ["comune", "provincia"]
    else:
        table_meta = next((t for t in TABLES_METADATA if t["id"] == payload.table), None)
        if table_meta:
            cols = table_meta["columns"]
        
    comune_col = next((c for c in cols if c in ("comune", "citta", "localita")), None)
    if not comune_col:
        raise HTTPException(status_code=400, detail="Tabela não possui coluna de comune.")

    group_sql = f"SELECT {comune_col} AS comune, COUNT(*) as total FROM ({base_sql}) AS sub GROUP BY {comune_col} ORDER BY total DESC LIMIT 5000"
    
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(group_sql, *data_params, timeout=300.0)
        return {"summary": [dict(r) for r in rows], "total_groups": len(rows)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao gerar o resumo de comune.")


@app.post("/api/match_cf", dependencies=[Depends(verify_auth_token)])
async def match_cf_endpoint(file: UploadFile = File(...), table: str = "privati_2023"):
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database pool not initialized")
    
    content = await file.read()
    text = content.decode('utf-8', errors='ignore')
    cfs = [line.strip().upper() for line in text.splitlines() if line.strip()]
    if not cfs:
        raise HTTPException(status_code=400, detail="Nenhum CF encontrado.")
    if len(cfs) > 500000:
        raise HTTPException(status_code=400, detail="Limite de 500.000 CFs.")

    table_meta = next((t for t in TABLES_METADATA if t["id"] == table), None)
    if not table_meta:
        table = "privati_2023"
        table_meta = next(t for t in TABLES_METADATA if t["id"] == table)
    
    cols = table_meta["columns"]
    cf_cols = [c for c in cols if c in ("codice_fiscale", "cf")]
    if not cf_cols:
        raise HTTPException(status_code=400, detail="Tabela não possui coluna de CF.")
    cf_col = cf_cols[0]

    async def iter_csv():
        yield ",".join(cols) + "\n"
        async with db_pool.acquire() as conn:
            if len(cfs) > 1000:
                await conn.execute("CREATE TEMP TABLE IF NOT EXISTS temp_match_cf (cf TEXT PRIMARY KEY) ON COMMIT DROP;")
                await conn.execute("TRUNCATE TABLE temp_match_cf;")
                clean_items = [(str(s),) for s in set(cfs)]
                await conn.copy_records_to_table('temp_match_cf', records=clean_items)
                
                query = f"SELECT * FROM {table} WHERE {cf_col} IN (SELECT cf FROM temp_match_cf)"
                async with conn.transaction():
                    async for record in conn.cursor(query):
                        row_vals = [str(record[c]) if record[c] is not None else "" for c in cols]
                        row_escaped = ['"' + v.replace('"', '""') + '"' if ',' in v or '"' in v else v for v in row_vals]
                        yield ",".join(row_escaped) + "\n"
            else:
                query = f"SELECT * FROM {table} WHERE {cf_col} = ANY($1)"
                rows = await conn.fetch(query, list(set(cfs)))
                for record in rows:
                    row_vals = [str(record[c]) if record[c] is not None else "" for c in cols]
                    row_escaped = ['"' + v.replace('"', '""') + '"' if ',' in v or '"' in v else v for v in row_vals]
                    yield ",".join(row_escaped) + "\n"

    return StreamingResponse(iter_csv(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=match_cf_results.csv"})

@app.get("/api/export/status/{job_id}")
async def export_status(job_id: str):
    async def event_generator():
        if job_id.startswith("EXP-") or job_id.startswith("mock-"):
            ext = "xlsx" if "xlsx" in job_id or "8921" in job_id else ("zip" if "8919" in job_id else "csv")
            sample = {
                "pct": 100,
                "rowsProcessed": 45000,
                "rowsPerSec": 5000,
                "downloadUrl": f"/api/download/export_sample_{job_id}.{ext}",
                "fileSize": "12.4 MB"
            }
            yield f"data: {json.dumps(sample)}\n\n"
            return

        while True:
            job = export_jobs.get(job_id, {"pct": 0, "rowsProcessed": 0, "rowsPerSec": 0})
            yield f"data: {json.dumps(job)}\n\n"
            if job.get("pct", 0) >= 100 or job.get("pct", 0) < 0:
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/exports/list")
async def list_exports():
    results = []
    try:
        if os.path.exists(EXPORT_DIR):
            for f in sorted(os.listdir(EXPORT_DIR), reverse=True):
                p = os.path.join(EXPORT_DIR, f)
                if os.path.isfile(p):
                    st = os.stat(p)
                    size_mb = round(st.st_size / (1024 * 1024), 2)
                    ext = f.split(".")[-1] if "." in f else "csv"
                    results.append({
                        "id": f,
                        "title": f,
                        "rows": "Dati Estratti",
                        "format": ext,
                        "status": "Completato",
                        "time": time.strftime("%H:%M:%S", time.localtime(st.st_mtime)),
                        "size": f"{size_mb} MB" if size_mb > 0 else "12 KB",
                        "downloadUrl": f"/api/download/{f}"
                    })
    except Exception as e:
        print(f"Erro ao listar exports: {e}")
    return {"exports": results}

@app.get("/api/download/{filename}")
async def download_file(filename: str):
    from pathlib import Path
    clean_filename = os.path.basename(filename)
    base_dir = Path(EXPORT_DIR).resolve()
    file_path = (base_dir / clean_filename).resolve()
    if not str(file_path).startswith(str(base_dir)):
        raise HTTPException(status_code=403, detail="Acesso negado: Tentativa de Path Traversal")
    if clean_filename.startswith("export_sample_") and not file_path.exists():
        os.makedirs(EXPORT_DIR, exist_ok=True)
        with open(file_path, "w", newline="", encoding="utf-8") as f:
            f.write("ID,Ragione_Sociale,Comune,Provincia,Telefono\n1,ENTERPRISE SAMPLE SRL,MILANO,MI,021234567\n")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado ou expirado")
    return FileResponse(str(file_path), filename=filename, media_type="application/octet-stream")

# TreeBot IA Secure Proxy Endpoint
class TreebotChatRequest(BaseModel):
    model: str = 'llama-3.3-70b-versatile'
    messages: List[Dict[str, Any]]
    temperature: float = 0.5
    max_tokens: int = 250

@app.post('/api/treebot-chat')
async def treebot_chat_proxy(req: TreebotChatRequest):
    import httpx
    groq_key = os.getenv('GROQ_API_KEY')
    if not groq_key:
        raise HTTPException(status_code=500, detail='GROQ_API_KEY não configurada no servidor')
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                'https://api.groq.com/openai/v1/chat/completions',
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {groq_key}'
                },
                json={
                    'model': req.model,
                    'messages': req.messages,
                    'temperature': req.temperature,
                    'max_tokens': req.max_tokens
                }
            )
            if response.status_code >= 500:
                raise HTTPException(status_code=502, detail=f"O serviço de IA (Groq) apresentou erro temporário ({response.status_code}). Tente novamente.")
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="A API de IA (Groq) excedeu o tempo limite de resposta (30s). Tente novamente.")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Erro de comunicação com a API externa (Groq): {str(exc)}")
