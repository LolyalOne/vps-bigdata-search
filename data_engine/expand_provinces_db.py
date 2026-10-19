import os
#!/usr/bin/env python3
import asyncio
import asyncpg
import time

DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:your_password@localhost:5432/bigdata_db")

PROVINCE_FULL_NAMES = {
    'AG': 'AGRIGENTO',
    'AL': 'ALESSANDRIA',
    'AN': 'ANCONA',
    'AO': 'AOSTA',
    'AP': 'ASCOLI PICENO',
    'AQ': "L'AQUILA",
    'AR': 'AREZZO',
    'AT': 'ASTI',
    'AV': 'AVELLINO',
    'BA': 'BARI',
    'BG': 'BERGAMO',
    'BI': 'BIELLA',
    'BL': 'BELLUNO',
    'BN': 'BENEVENTO',
    'BO': 'BOLOGNA',
    'BR': 'BRINDISI',
    'BS': 'BRESCIA',
    'BT': 'BARLETTA-ANDRIA-TRANI',
    'BZ': 'BOLZANO',
    'CA': 'CAGLIARI',
    'CB': 'CAMPOBASSO',
    'CE': 'CASERTA',
    'CH': 'CHIETI',
    'CL': 'CALTANISSETTA',
    'CN': 'CUNEO',
    'CO': 'COMO',
    'CR': 'CREMONA',
    'CS': 'COSENZA',
    'CT': 'CATANIA',
    'CZ': 'CATANZARO',
    'EN': 'ENNA',
    'FC': 'FORLÌ-CESENA',
    'FE': 'FERRARA',
    'FG': 'FOGGIA',
    'FI': 'FIRENZE',
    'FM': 'FERMO',
    'FR': 'FROSINONE',
    'GE': 'GENOVA',
    'GO': 'GORIZIA',
    'GR': 'GROSSETO',
    'IM': 'IMPERIA',
    'IS': 'ISERNIA',
    'KR': 'CROTONE',
    'LC': 'LECCO',
    'LE': 'LECCE',
    'LI': 'LIVORNO',
    'LO': 'LODI',
    'LT': 'LATINA',
    'LU': 'LUCCA',
    'MB': 'MONZA E DELLA BRIANZA',
    'MC': 'MACERATA',
    'ME': 'MESSINA',
    'MI': 'MILANO',
    'MN': 'MANTOVA',
    'MO': 'MODENA',
    'MS': 'MASSA-CARRARA',
    'MT': 'MATERA',
    'NA': 'NAPOLI',
    'NO': 'NOVARA',
    'NU': 'NUORO',
    'OR': 'ORISTANO',
    'PA': 'PALERMO',
    'PC': 'PIACENZA',
    'PD': 'PADOVA',
    'PE': 'PESCARA',
    'PG': 'PERUGIA',
    'PI': 'PISA',
    'PN': 'PORDENONE',
    'PO': 'PRATO',
    'PR': 'PARMA',
    'PT': 'PISTOIA',
    'PU': 'PESARO E URBINO',
    'PV': 'PAVIA',
    'PZ': 'POTENZA',
    'RA': 'RAVENNA',
    'RC': 'REGGIO CALABRIA',
    'RE': 'REGGIO EMILIA',
    'RG': 'RAGUSA',
    'RI': 'RIETI',
    'RM': 'ROMA',
    'RN': 'RIMINI',
    'RO': 'ROVIGO',
    'SA': 'SALERNO',
    'SI': 'SIENA',
    'SO': 'SONDRIO',
    'SP': 'LA SPEZIA',
    'SR': 'SIRACUSA',
    'SS': 'SASSARI',
    'SU': 'SUD SARDEGNA',
    'SV': 'SAVONA',
    'TA': 'TARANTO',
    'TE': 'TERAMO',
    'TN': 'TRENTO',
    'TO': 'TORINO',
    'TP': 'TRAPANI',
    'TR': 'TERNI',
    'TS': 'TRIESTE',
    'TV': 'TREVISO',
    'UD': 'UDINE',
    'VA': 'VARESE',
    'VB': 'VERBANO-CUSIO-OSSOLA',
    'VC': 'VERCELLI',
    'VE': 'VENEZIA',
    'VI': 'VICENZA',
    'VR': 'VERONA',
    'VT': 'VITERBO',
    'VV': 'VIBO VALENTIA',
    'CI': 'CARBONIA-IGLESIAS',
    'VS': 'MEDIO CAMPIDANO',
    'OG': 'OGLIASTRA',
    'OT': 'OLBIA-TEMPIO',
    'FO': 'FORLÌ',
    'PS': 'PESARO'
}

async def main():
    print("🚀 Connecting to PostgreSQL to expand province codes to full names across the entire database...")
    conn = await asyncpg.connect(DB_DSN)
    await conn.execute("SET statement_timeout = 0;")
    
    try:
        # Create provincia_mapping table
        print("Creating and populating provincia_mapping table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS provincia_mapping (
                sigla TEXT PRIMARY KEY,
                nome_completo TEXT NOT NULL
            );
        """)
        
        # Insert or update mappings
        for sigla, nome in PROVINCE_FULL_NAMES.items():
            await conn.execute("""
                INSERT INTO provincia_mapping (sigla, nome_completo)
                VALUES ($1, $2)
                ON CONFLICT (sigla) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
            """, sigla, nome)
            
        print("✅ provincia_mapping populated with 113 province mappings.")

        # Tables to expand provinces in
        tables = [
            "privati_2023", "email_privati", "aziende_2023", 
            "nord_totale", "censud_totale", "isole_finalissimo", 
            "villette_official_ago_26", "aziende_fissi_2025_completo", "aziende_fissi_2025_pi_cf"
        ]
        print("\n--- 📍 EXPANDING PROVINCE CODES TO FULL NAMES ACROSS ALL TABLES ---")
        
        for tbl in tables:
            t0 = time.time()
            print(f"🔄 Expanding provinces in {tbl}...")
            
            cols = [r['column_name'] for r in await conn.fetch(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{tbl}';")]
            prov_col = 'provincia' if 'provincia' in cols else ('prov' if 'prov' in cols else ('pv' if 'pv' in cols else None))
            
            if not prov_col:
                print(f"⚠️ Table {tbl} does not have 'provincia', 'prov' or 'pv' column, skipping.")
                continue
                
            sql = f"""
                UPDATE {tbl} t
                SET {prov_col} = pm.nome_completo
                FROM provincia_mapping pm
                WHERE UPPER(TRIM(t.{prov_col})) = pm.sigla
                  AND t.{prov_col} IS DISTINCT FROM pm.nome_completo;
            """
            res = await conn.execute(sql)
            dt = round(time.time() - t0, 2)
            print(f"✅ [{tbl}] {res} expanded to full province names in {dt}s.")

        print("\n🏆 ALL PROVINCES EXPANDED TO FULL NAMES SUCCESSFULLY!")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
