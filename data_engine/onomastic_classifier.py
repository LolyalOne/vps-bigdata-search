import os
#!/usr/bin/env python3
import asyncio
import asyncpg
import re

# Comprehensive international surname & first name dictionaries for origin classification & segmentation
ORIGIN_SURNAME_DICTIONARIES = {
    "CINESE": {
        "ZHANG", "WANG", "LI", "ZHAO", "CHEN", "LIU", "YANG", "HUANG", "ZHOU", "WU", "XU", "SUN", "HU", "ZHU", "GAO",
        "LIN", "HE", "GUO", "MA", "LUO", "LIANG", "SONG", "ZHENG", "XIE", "HAN", "TANG", "FENG", "YU", "DONG", "XIAO",
        "CHENG", "CAO", "YUAN", "DENG", "XUAN", "FU", "SHEN", "ZENG", "PENG", "LU", "SU", "JIANG", "CAI", "JIA", "DING",
        "WEI", "XUE", "YE", "YAN", "PAN", "DU", "DAI", "XIA", "ZHO", "HONG", "QIAN", "QIU", "SHI", "GU", "HOU", "SHAO",
        "MENG", "LONG", "WAN", "TIN", "MO", "CONG", "ZHAN", "TAO", "SHAN", "KONG", "CHOW", "WONG", "CHAN", "CHEUNG",
        "LAU", "KWOK", "LEUNG", "CHUI", "TSANG"
    },
    "BRASILIANO_PORTOGHESE": {
        "SILVA", "SOUZA", "SOUSA", "SANTOS", "OLIVEIRA", "PEREIRA", "FERREIRA", "COSTA", "RODRIGUES", "ALVES",
        "NASCIMENTO", "LIMA", "ARAUJO", "FERNANDES", "CARVALHO", "GOMES", "MARTINS", "ROCHA", "RIBEIRO", "ALMEIDA",
        "BARBOSA", "CARDOSO", "SANTANA", "TEIXEIRA", "MOREIRA", "CORREA", "CAVALCANTI", "DIAS", "MENDES", "NUNES",
        "VIEIRA", "MONTEIRO", "MORAIS", "CAVALCANTE", "PINTO", "MELO", "NEVES", "LEITE", "CAMPOS", "TAVARES", "MAGALHAES",
        "MARQUES", "MACHADO", "FREITAS", "BATISTA", "SILVEIRA", "MIRANDA", "RANGEL", "BARROS", "COUTINHO", "PEIXOTO"
    },
    "TEDESCO_GERMANICO": {
        "MULLER", "MUELLER", "SCHMIDT", "SCHNEIDER", "FISCHER", "WEBER", "MEYER", "WAGNER", "BECKER", "SCHULZ",
        "HOFFMANN", "SCHAEFER", "KOCH", "BAUER", "RICHTER", "KLEIN", "WOLF", "SCHROEDER", "NEUMANN", "SCHWARZ",
        "ZIMMERMANN", "BRAUN", "KRUEGER", "HOFMANN", "HARTMANN", "LANGE", "SCHMITT", "WERNER", "SCHMITZ", "KRAUSE",
        "MEIER", "LEHMANN", "SCHMID", "SCHULZE", "MAIER", "KOEHLER", "HERRMANN", "WALTER", "ROTH", "BECK", "LORENZ"
    },
    "ISPANO_LATINO": {
        "GARCIA", "RODRIGUEZ", "GONZALEZ", "FERNANDEZ", "LOPEZ", "MARTINEZ", "SANCHEZ", "PEREZ", "GOMEZ", "MARTIN",
        "JIMENEZ", "RUIZ", "HERNANDEZ", "DIAZ", "MORENO", "MUÑOZ", "ALVAREZ", "ROMERO", "ALONSO", "GUTIERREZ",
        "NAVARRO", "TORRES", "DOMINGUEZ", "VAZQUEZ", "RAMOS", "GIL", "RAMIREZ", "SERRANO", "BLANCO", "MOLINA",
        "MORALES", "SUAREZ", "ORTEGA", "DELGADO", "CASTRO", "ORTIZ", "RUBIO", "MARIN", "SANZ", "NÚÑEZ", "IGLESIAS"
    },
    "SLAVO_EST_EUROPEO": {
        "POPA", "RUSU", "POPOVICI", "RADU", "DUMITRU", "STAN", "STOICA", "GHEORGHE", "MATEI", "CIOBANU", "IONESCU",
        "MOLDOVAN", "VLAD", "POPOVIC", "PETROV", "IVANOV", "NOVAK", "HORVAT", "KOVACS", "DIMITROV", "SMIRNOV",
        "KUZNETSOV", "VASILIEV", "SOKOLOV", "MIKHAILOV", "FEDOROV", "MOROZOV", "VOLKOV", "ALEXEEV", "LEBEDEV", "STEFANOV"
    },
    "ARABO_MEDIO_ORIENTE": {
        "AHMED", "ALI", "MOHAMED", "HASSAN", "IBRAHIM", "HUSSAIN", "KHAN", "MAHMOUD", "SALAH", "SALEH", "SAYED",
        "YOUSSEF", "ABDULLAH", "OMAR", "MOUSA", "ABDEL", "FARAG", "FAWZY", "GHARIB", "HABIB", "KHALIL", "MANSOUR",
        "MOSTAPHA", "RADWAN", "SHERIF", "SOLIMAN", "ZAKI", "RAHMAN", "RAHIM", "ISMAIL", "MALIK"
    }
}

COMMON_FIRST_NAMES = {
    "MARIO", "GIUSEPPE", "ANTONIO", "GIOVANNI", "FRANCESCO", "LUIGI", "ROBERTO", "STEFANO", "ALESSANDRO", "PAOLO",
    "MARCO", "CARLO", "CLAUDIO", "MASSIMO", "ANDREA", "SERGIO", "DANIELA", "MARIA", "ANNA", "ROSA", "ANGELA",
    "GIOVANNA", "TERESA", "LUCIA", "CARMELA", "CATERINA", "FRANCESCA", "LUISA", "ELENA", "SILVANA", "ALBERTO",
    "VINCENZO", "SALVATORE", "DOMENICO", "NICOLA", "PIETRO", "FILIPPO", "CRISTIAN", "FEDERICO", "GABRIELE",
    "GIULIO", "LORENZO", "MATTEO", "SIMONE", "CHIARA", "ELISA", "GIULIA", "LAURA", "MARTINA", "SARA", "VALENTINA",
    "SILVIA", "FEDERICA", "BARBARA", "PATRIZIA", "PAOLA", "ROBERTA", "MONICA", "STEFANIA", "LOREDANA", "JUCY",
    "LUCIANA", "CLAUDIA", "ALICE", "BEATRICE", "ELEONORA", "IRENE", "VERONICA", "MANUELA", "MICHELA", "DOMENICA",
    "NATALE", "GUIDO", "BRUNO", "PIERO", "GAETANO", "MAURIZIO", "MAURO", "LISA"
}

# Known pure Italian surnames to prevent splitting common names
COMMON_ITALIAN_SURNAMES = {
    "ROSSI", "RUSSO", "FERRARI", "ESPOSITO", "BIANCHI", "ROMANO", "COLOMBO", "RICCI", "MARINO", "GRECO", "BRUNO",
    "GALLO", "CONTI", "DE LUCA", "MANCINI", "COSTA", "GIORDANO", "RIZZI", "LOMBARDI", "MORETTI", "BARBIERI",
    "FONTANA", "SANTORO", "MARIANI", "RINALDI", "CARUSO", "FERRARA", "GALLI", "MARTINI", "LEONE", "LONGO", "GENTILE",
    "MARTINELLE", "VITALE", "LOMBARDO", "SERRA", 'COPPOLA', "DE SANTIS", "D'ANGELO", "RUGGIERO", "MANCUSO",
    "MAURIZIO", "MALASPINA", "MONTANARO", "PIACENZA", "ACQUAVIVA", "TORINESE", "CATANZARO", "TORVISCOSA", "LANCIANO"
}

def split_concatenated_phrase(text: str) -> tuple:
    """Splits concatenated text (like JUCYSOUZA or MARIOROSSI) cleanly."""
    if not text or " " in text.strip():
        parts = text.strip().split(maxsplit=1)
        if len(parts) == 2:
            return parts[0], parts[1]
        return text.strip(), ""
        
    clean = text.strip().upper()
    if clean in COMMON_FIRST_NAMES or clean in COMMON_ITALIAN_SURNAMES:
        return "", clean

    # 1. Check if it starts with an EXACT known first name (at least 4 chars) and leaves a valid remainder >= 3 chars
    for fn in sorted(COMMON_FIRST_NAMES, key=len, reverse=True):
        if len(fn) >= 4 and clean.startswith(fn) and len(clean) >= len(fn) + 3:
            surname_part = clean[len(fn):]
            return fn, surname_part

    # 2. Check if it ends with an EXACT known foreign or Italian surname of length >= 4 chars
    for origin, surnames in ORIGIN_SURNAME_DICTIONARIES.items():
        for s in sorted(surnames, key=len, reverse=True):
            if len(s) >= 4 and clean.endswith(s) and len(clean) >= len(s) + 3:
                name_part = clean[:-len(s)]
                return name_part, s

    # 3. If short foreign surnames like LI, WU, HU, only split if the first name is EXACTLY in COMMON_FIRST_NAMES
    for s in ["LI", "WU", "HU", "LU", "YE", "MA", "XU", "DU"]:
        if clean.endswith(s) and clean[:-len(s)] in COMMON_FIRST_NAMES:
            return clean[:-len(s)], s
        if clean.startswith(s) and clean[len(s):] in COMMON_FIRST_NAMES:
            return clean[len(s):], s
                
    return clean, ""

def classify_surname_origin(surname: str, name: str = "") -> tuple:
    """Returns (Origin_Cluster, Confidence) based on surname and name."""
    s_upper = (surname or "").strip().upper()
    n_upper = (name or "").strip().upper()
    
    if not s_upper:
        return "ITALIANO", 0.70
        
    # Check exact match or word-boundary match in origin dictionaries
    for origin, surnames in ORIGIN_SURNAME_DICTIONARIES.items():
        if s_upper in surnames:
            return origin, 0.98
        parts = s_upper.split()
        if any(p in surnames for p in parts):
            return origin, 0.95

    # Check characteristic N-gram rules for distinct foreign patterns (ONLY when surname >= 4 chars to avoid false matches on MA/LI)
    if len(s_upper) >= 4:
        if re.search(r"^(ZHANG|WANG|CHEN|LIANG|ZHENG|HUANG|CHENG|ZHOU|XIAO)$", s_upper):
            return "CINESE", 0.92
        if re.search(r"(SOUZA|SOUSA|SILVA|RODRIGUES|OLIVEIRA|PEREIRA|FERREIRA|CARVALHO|ARAUJO|CAVALCANTE|CAVALCANTI)$", s_upper):
            return "BRASILIANO_PORTOGHESE", 0.92
        if re.search(r"(MULLER|MUELLER|SCHMIDT|SCHNEIDER|FISCHER|WEBER|HOFFMANN|SCHROEDER|ZIMMERMANN)$", s_upper):
            return "TEDESCO_GERMANICO", 0.92
        if re.search(r"(GARCIA|GONZALEZ|RODRIGUEZ|HERNANDEZ|MARTINEZ|FERNANDEZ|GUTIERREZ|DOMINGUEZ)$", s_upper):
            return "ISPANO_LATINO", 0.92
        if re.search(r"(POPOVIC|PETROV|IVANOV|MOLDOVAN|DIMITROV|SMIRNOV|KUZNETSOV|VASILIEV)$", s_upper):
            return "SLAVO_EST_EUROPEO", 0.92
        
    # Default to ITALIANO if typical Italian structure
    if s_upper[-1] in {'A', 'E', 'I', 'O'} or s_upper in COMMON_ITALIAN_SURNAMES:
        return "ITALIANO", 0.85
        
    return "ALTRO_ESTERO", 0.60

def disambiguate_single_field_name(text: str) -> tuple:
    """Given a space-separated phrase in a single field (like 'MARIO ROSSI' or 'ALESSANDRO LUETTO'),
    determines (nome_clean, cognome_clean, origin, conf)."""
    parts = text.strip().split(maxsplit=1)
    if len(parts) == 1:
        origin, conf = classify_surname_origin(parts[0], "")
        return "", parts[0], origin, conf

    w1, w2 = parts[0].upper(), parts[1].upper()

    # 1. If w1 is a known first name and w2 is not: w1=nome, w2=cognome
    if w1 in COMMON_FIRST_NAMES and w2 not in COMMON_FIRST_NAMES:
        origin, conf = classify_surname_origin(w2, w1)
        return w1, w2, origin, conf

    # 2. If w2 is a known first name and w1 is not: w2=nome, w1=cognome
    if w2 in COMMON_FIRST_NAMES and w1 not in COMMON_FIRST_NAMES:
        origin, conf = classify_surname_origin(w1, w2)
        return w2, w1, origin, conf

    # 3. Check surname dictionaries
    w1_is_surname = (w1 in COMMON_ITALIAN_SURNAMES or any(w1 in d for d in ORIGIN_SURNAME_DICTIONARIES.values()))
    w2_is_surname = (w2 in COMMON_ITALIAN_SURNAMES or any(w2 in d for d in ORIGIN_SURNAME_DICTIONARIES.values()))

    if w1_is_surname and not w2_is_surname:
        origin, conf = classify_surname_origin(w1, w2)
        return w2, w1, origin, conf
    if w2_is_surname and not w1_is_surname:
        origin, conf = classify_surname_origin(w2, w1)
        return w1, w2, origin, conf

    # 4. Fallback check: which yields a stronger non-Italian cluster
    o1, c1 = classify_surname_origin(w1, w2)
    o2, c2 = classify_surname_origin(w2, w1)
    if o1 != "ITALIANO" and o2 == "ITALIANO":
        return w2, w1, o1, c1
    if o2 != "ITALIANO" and o1 == "ITALIANO":
        return w1, w2, o2, c2

    # Standard Italian administrative format default: COGNOME NOME (w1=cognome, w2=nome)
    return w2, w1, o1, c1

async def build_onomastic_database():
    print("🚀 Connecting to PostgreSQL...")
    conn = await asyncpg.connect("postgresql://postgres:your_secure_password@127.0.0.1:5432/bigdata_db")
    
    print("🛠️ Creating onomastic_mapping table...")
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS onomastic_mapping (
            raw_text TEXT PRIMARY KEY,
            nome_clean TEXT,
            cognome_clean TEXT,
            origine_etnica TEXT NOT NULL,
            confidence FLOAT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_onomastic_origine ON onomastic_mapping(origine_etnica);
        CREATE INDEX IF NOT EXISTS idx_onomastic_cognome ON onomastic_mapping(cognome_clean);
    """)
    
    print("📊 Extracting distinct surnames and full names across privati_2023 and email_privati...")
    raw_surnames = set()
    
    rows_priv = await conn.fetch("SELECT DISTINCT cognome, nome FROM privati_2023 WHERE cognome IS NOT NULL AND TRIM(cognome) != '';")
    for r in rows_priv:
        raw_surnames.add((r["cognome"].strip().upper(), (r["nome"] or "").strip().upper()))
        
    rows_email = await conn.fetch("SELECT DISTINCT cognome_e_nome FROM email_privati WHERE cognome_e_nome IS NOT NULL AND TRIM(cognome_e_nome) != '';")
    for r in rows_email:
        raw_surnames.add((r["cognome_e_nome"].strip().upper(), ""))
        
    print(f"📦 Total distinct name/surname pairs to classify & segment: {len(raw_surnames)}")
    
    records_to_insert = []
    
    for cognome_raw, nome_raw in raw_surnames:
        pos_space = cognome_raw.find(' ')
        if not nome_raw:
            if pos_space == -1:
                # Concatenated single word or single surname
                n_split, c_split = split_concatenated_phrase(cognome_raw)
                if c_split and n_split and n_split != cognome_raw:
                    origin, conf = classify_surname_origin(c_split, n_split)
                    records_to_insert.append((cognome_raw, n_split, c_split, origin, conf))
                else:
                    origin, conf = classify_surname_origin(cognome_raw, "")
                    records_to_insert.append((cognome_raw, "", cognome_raw, origin, conf))
            else:
                # Space separated phrase in single field like cognome_e_nome ("MARIO ROSSI" or "ALESSANDRO LUETTO")
                n_clean, c_clean, origin, conf = disambiguate_single_field_name(cognome_raw)
                records_to_insert.append((cognome_raw, n_clean, c_clean, origin, conf))
        else:
            # Standard separate fields (cognome_raw + nome_raw)
            if pos_space == -1 and len(cognome_raw) > 12 and not nome_raw:
                n_split, c_split = split_concatenated_phrase(cognome_raw)
                origin, conf = classify_surname_origin(c_split or cognome_raw, n_split or nome_raw)
                records_to_insert.append((cognome_raw, n_split, c_split or cognome_raw, origin, conf))
            else:
                origin, conf = classify_surname_origin(cognome_raw, nome_raw)
                records_to_insert.append((cognome_raw, nome_raw, cognome_raw, origin, conf))
                
    print(f"💾 Inserting/updating {len(records_to_insert)} classified records into onomastic_mapping in chunks...")
    
    chunk_size = 5000
    for i in range(0, len(records_to_insert), chunk_size):
        chunk = records_to_insert[i:i+chunk_size]
        await conn.executemany("""
            INSERT INTO onomastic_mapping (raw_text, nome_clean, cognome_clean, origine_etnica, confidence)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (raw_text) DO UPDATE SET 
                nome_clean = EXCLUDED.nome_clean,
                cognome_clean = EXCLUDED.cognome_clean,
                origine_etnica = EXCLUDED.origine_etnica,
                confidence = EXCLUDED.confidence;
        """, chunk)
        
    print("✅ Onomastic mapping & classification table populated!")
    
    stats = await conn.fetch("SELECT origine_etnica, count(*) as cnt FROM onomastic_mapping GROUP BY origine_etnica ORDER BY count(*) DESC;")
    print("\n📊 Origin Classification Distribution across unique surnames/names:")
    for r in stats:
        print(f"   {r['origine_etnica']}: {r['cnt']} unique patterns")
        
    print("\n🔍 Checking 2nd generation immigrants (Born in Italy with foreign origin cluster):")
    gen2_samples = await conn.fetch("""
        SELECT p.nome, p.cognome, p.comune, p.codice_fiscale, o.origine_etnica
        FROM privati_2023 p
        JOIN onomastic_mapping o ON p.cognome = o.cognome_clean
        WHERE o.origine_etnica IN ('CINESE', 'BRASILIANO_PORTOGHESE', 'TEDESCO_GERMANICO', 'ISPANO_LATINO', 'SLAVO_EST_EUROPEO', 'ARABO_MEDIO_ORIENTE')
          AND LENGTH(p.codice_fiscale) = 16
          AND SUBSTRING(p.codice_fiscale, 12, 1) != 'Z'
        LIMIT 20;
    """)
    for r in gen2_samples:
        print(f"   {r['nome']} {r['cognome']} ({r['comune']}) - CF: {r['codice_fiscale']} ➔ Origin: {r['origine_etnica']} (Born in Italy)")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(build_onomastic_database())
