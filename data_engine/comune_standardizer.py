import os
#!/usr/bin/env python3
import asyncio
import asyncpg
import re
from difflib import get_close_matches

# Official Italian province codes
PROV_CODES = {
    "AG", "AL", "AN", "AO", "AP", "AQ", "AR", "AT", "AV", "BA", "BG", "BI", "BL", "BN", "BO", "BR", "BS", "BT",
    "BZ", "CA", "CB", "CE", "CH", "CL", "CN", "CO", "CR", "CS", "CT", "CZ", "EN", "FC", "FE", "FG", "FI", "FM",
    "FR", "GE", "GO", "GR", "IM", "IS", "KR", "LC", "LE", "LI", "LO", "LT", "LU", "MB", "MC", "ME", "MI", "MN",
    "MO", "MS", "MT", "NA", "NO", "NU", "OR", "PA", "PC", "PD", "PE", "PG", "PI", "PN", "PO", "PR", "PT", "PU",
    "PV", "PZ", "RA", "RC", "RE", "RG", "RI", "RM", "RN", "RO", "SA", "SI", "SO", "SP", "SR", "SS", "SU", "SV",
    "TA", "TE", "TN", "TO", "TP", "TR", "TS", "TV", "UD", "VA", "VB", "VC", "VE", "VI", "VR", "VT"
}

FEMALE_SAINTS = {
    "MARIA", "LUCIA", "CRISTINA", "CATERINA", "CROCE", "MARGHERITA", "SOFIA",
    "TERESA", "FLAVIA", "DOMENICA", "SEVERINA", "CESAREA", "GIUSTINA", "BRIGIDA",
    "VITTORIA", "VENERINA", "ELISABETTA", "BARBARA", "CHIARA"
}
VOWEL_SAINTS = {
    "AGATA", "ANGELO", "AMBROGIO", "ANTIMO", "ANASTASIA", "ANDREA", "APOLLINARE",
    "ELENA", "ILARIO", "OLCESE", "ONOFRIO", "ORESTE", "ARSENIO", "ANTIOCO",
    "AGNELLO", "EGIDIO", "EUSANIO"
}

def clean_town_string(raw: str) -> str:
    if not raw:
        return ""
    raw_str = raw.strip()

    # Rule 1: Reject strings containing digits (phone numbers, house numbers, CAP, dates, etc.)
    if re.search(r"\d", raw_str):
        return ""

    # Rule 2: Reject Codici Fiscali (16-char alphanumeric)
    if re.match(r"^[A-Z0-9]{16}$", raw_str, flags=re.IGNORECASE):
        return ""

    # Rule 3: Reject street addresses and non-municipality entries
    if re.search(r"\b(VIA|VIALE|CORSO|VICOLO|LARGO|OSPEDALE|SNC|ANGOLO|ANG\.)\b", raw_str, flags=re.IGNORECASE):
        return ""
    if re.search(r"\bPIAZZA\s+CADUTI\b", raw_str, flags=re.IGNORECASE):
        return ""
    if re.search(r"\bSTRADA\b", raw_str, flags=re.IGNORECASE) and not re.search(r"\bSTRADA\s+(SULLA\s+)?(DEL\s+)?VINO\b", raw_str, flags=re.IGNORECASE):
        return ""

    # Remove leading "- ) " or "- - " from weird comuni table entries
    s = re.sub(r"^[-)\s/]+", "", raw_str).strip()
    
    # Remove "(MILANO) LOMBARDIA" style suffixes
    s = re.sub(r"\s*\([A-Z\s]+\)\s*[A-Z]*$", "", s, flags=re.IGNORECASE).strip()
    
    # Remove trailing province code if 2 uppercase letters separated by space
    parts = s.split()
    if len(parts) > 1 and parts[-1].upper() in PROV_CODES:
        parts.pop()
        s = " ".join(parts)
        
    # Standardize abbreviations: S. -> SAN / SANT / SANTA
    s = re.sub(r"\bS\.\s*ANTONIO\b", "SAN ANTONIO", s, flags=re.IGNORECASE)
    s = re.sub(r"\bS\.\s*GIOVANNI\b", "SAN GIOVANNI", s, flags=re.IGNORECASE)
    s = re.sub(r"\bS\.\s*GIUSEPPE\b", "SAN GIUSEPPE", s, flags=re.IGNORECASE)
    s = re.sub(r"\bS\.\s*PIETRO\b", "SAN PIETRO", s, flags=re.IGNORECASE)

    def _replace_saint(m):
        next_word = m.group(1).upper()
        if next_word in FEMALE_SAINTS:
            return f"SANTA {m.group(1)}"
        if next_word in VOWEL_SAINTS or next_word[0] in "AEIOU":
            return f"SANT'{m.group(1)}"
        return f"SAN {m.group(1)}"

    s = re.sub(r"\bS\.\s*([A-Za-zÀ-ÿ]+)\b", _replace_saint, s)
    s = re.sub(r"\bS\.\s*", "SAN ", s, flags=re.IGNORECASE)
    
    # Fix common smashed phrases like alserio -> al serio
    s = re.sub(r"\balserio\b", "al serio", s, flags=re.IGNORECASE)
    
    return s.strip().upper()

async def build_comune_mapping():
    print("🚀 Connecting to PostgreSQL...")
    conn = await asyncpg.connect("postgresql://postgres:your_secure_password@127.0.0.1:5432/bigdata_db")
    
    print("🛠️ Creating comune_mapping table...")
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS comune_mapping (
            raw_name TEXT PRIMARY KEY,
            canonical_name TEXT NOT NULL,
            confidence FLOAT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_comune_mapping_canonical ON comune_mapping(canonical_name);
    """)
    
    print("📊 Loading distinct raw towns across all tables...")
    raw_towns_set = set()
    
    for tbl, col in [
        ("privati_2023", "comune"),
        ("aziende_2023", "comune"),
        ("censud_totale", "citta"),
        ("nord_totale", "citta"),
        ("email_privati", "comune")
    ]:
        rows = await conn.fetch(f"SELECT DISTINCT {col} FROM {tbl} WHERE {col} IS NOT NULL AND TRIM({col}) != '';")
        for r in rows:
            raw_towns_set.add(r[col])
            
    print(f"📦 Total distinct raw town strings across tables: {len(raw_towns_set)}")
    
    # Load official italian towns from ISTAT / cleaned comuni + reference list
    official_rows = await conn.fetch("""
        SELECT DISTINCT citta FROM comuni 
        WHERE citta IS NOT NULL AND TRIM(citta) != ''
          AND citta !~ '[0-9]'
          AND citta !~* '\\mvia\\M'
          AND citta !~* '^(corso|viale|vicolo|largo|piazza caduti)\\M';
    """)
    official_cleaned = set()
    for r in official_rows:
        cleaned = clean_town_string(r["citta"])
        if cleaned and len(cleaned) > 2:
            official_cleaned.add(cleaned)
            
    # Add famous international towns and canonical variations directly
    additional_canonical = {
        "ORIO AL SERIO", "SANTO ANTONIO DE JESUS", "MILANO", "ROMA", "NAPOLI", "TORINO", "PALERMO", "GENOVA",
        "BOLOGNA", "FIRENZE", "BARI", "CATANIA", "VENEZIA", "VERONA", "MESSINA", "PADOVA", "TRIESTE", "TARANTO",
        "BRESCIA", "PARMA", "PRATO", "MODENA", "REGGIO CALABRIA", "REGGIO EMILIA", "PERUGIA", "LIVORNO", "RAVENNA",
        "CAGLIARI", "FOGGIA", "RIMINI", "SALERNO", "FERRARA", "SASSARI", "LATINA", "GIUGLIANO IN CAMPANIA",
        "MONZA", "SIRACUSA", "PESCARA", "BERGAMO", "FORLI", "TRENTO", "VICENZA", "TERNI", "BOLZANO", "NOVARA",
        "PIACENZA", "ANCONA", "ANDRIA", "AREZZO", "UDINE", "CESENA", "LECCE"
    }
    official_list = sorted(list(official_cleaned.union(additional_canonical)))
    print(f"🏛️ Total canonical reference towns available: {len(official_list)}")
    
    mappings_to_insert = []
    
    for raw in raw_towns_set:
        cleaned = clean_town_string(raw)
        if not cleaned:
            continue
        
        # 1. Exact match after cleaning
        if cleaned in official_cleaned or cleaned in additional_canonical:
            mappings_to_insert.append((raw, cleaned, 1.0))
            continue
            
        # 2. Fuzzy match against official list using get_close_matches (fast cutoff 0.85)
        matches = get_close_matches(cleaned, official_list, n=1, cutoff=0.85)
        if matches:
            mappings_to_insert.append((raw, matches[0], 0.9))
        else:
            # If no close match, keep the cleaned standardized string as canonical
            mappings_to_insert.append((raw, cleaned, 0.7))
            
    print(f"💾 Inserting/updating {len(mappings_to_insert)} mappings into comune_mapping in chunks...")
    chunk_size = 5000
    for i in range(0, len(mappings_to_insert), chunk_size):
        chunk = mappings_to_insert[i:i+chunk_size]
        await conn.executemany("""
            INSERT INTO comune_mapping (raw_name, canonical_name, confidence)
            VALUES ($1, $2, $3)
            ON CONFLICT (raw_name) DO UPDATE SET canonical_name = EXCLUDED.canonical_name, confidence = EXCLUDED.confidence;
        """, chunk)
        print(f"   💾 Saved chunk {i//chunk_size + 1}/{(len(mappings_to_insert) + chunk_size - 1)//chunk_size} ({len(chunk)} rows)")
    
    print("✅ Comune mapping table populated successfully!")
    
    # Test sample variations
    test_rows = await conn.fetch("""
        SELECT raw_name, canonical_name, confidence FROM comune_mapping
        WHERE raw_name ILIKE '%antonio%' OR raw_name ILIKE '%orio%serio%' OR raw_name ILIKE '%cisliano%'
        ORDER BY canonical_name, raw_name
        LIMIT 25;
    """)
    print("\n🔍 Sample Mappings Created:")
    for r in test_rows:
        print(f"   '{r['raw_name']}'  ➔  '{r['canonical_name']}' (conf: {r['confidence']})")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(build_comune_mapping())
