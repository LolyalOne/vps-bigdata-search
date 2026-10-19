import os
#!/usr/bin/env python3
import asyncio
import asyncpg
import time

DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:your_password@localhost:5432/bigdata_db")

async def main():
    print("🚀 Connecting to PostgreSQL for Full Database Normalization...")
    conn = await asyncpg.connect(DB_DSN)
    await conn.execute("SET statement_timeout = 0;")
    
    try:
        # PART 1: Comune & Provincia Normalization across tables
        tables = [
            "privati_2023", "email_privati", "aziende_2023", 
            "nord_totale", "censud_totale", "isole_finalissimo", 
            "villette_official_ago_26", "aziende_fissi_2025_completo", "aziende_fissi_2025_pi_cf"
        ]
        print("\n--- 📍 PART 1: NORMALIZING COMUNE & PROVINCIA ACROSS ALL TABLES ---")
        for tbl in tables:
            t0 = time.time()
            print(f"🔄 Normalizing comune & provincia for {tbl}...")
            # Check existing columns
            cols = [r['column_name'] for r in await conn.fetch(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{tbl}';")]
            
            # Identify columns handling variations
            comune_col = 'comune' if 'comune' in cols else ('citta' if 'citta' in cols else ('localita' if 'localita' in cols else None))
            prov_col = 'provincia' if 'provincia' in cols else ('prov' if 'prov' in cols else ('pv' if 'pv' in cols else None))
            
            res_c = "0"
            if comune_col:
                # Normalize comune using comune_mapping
                sql_comune = f"""
                    UPDATE {tbl} t
                    SET {comune_col} = m.canonical_name
                    FROM comune_mapping m
                    WHERE t.{comune_col} = m.raw_name 
                      AND m.raw_name != m.canonical_name
                      AND t.{comune_col} IS DISTINCT FROM m.canonical_name;
                """
                res_c = await conn.execute(sql_comune)
            else:
                print(f"⚠️ Table {tbl} does not have a valid city column (comune/citta/localita).")
            
            res_p = "0"
            if prov_col:
                sql_prov = f"""
                    UPDATE {tbl}
                    SET {prov_col} = UPPER(TRIM({prov_col}))
                    WHERE {prov_col} IS NOT NULL AND {prov_col} != UPPER(TRIM({prov_col}));
                """
                res_p = await conn.execute(sql_prov)
            else:
                print(f"⚠️ Table {tbl} does not have a valid province column (provincia/prov/pv).")
                
            dt = round(time.time() - t0, 2)
            print(f"✅ [{tbl}] Comune: {res_c} | Provincia: {res_p} (in {dt}s)")

        # PART 2: Onomastic Normalization (privati_2023)
        print("\n--- 🧑‍🤝‍🧑 PART 2: ONOMASTIC NORMALIZATION & 2nd GENERATION (privati_2023) ---")
        t0 = time.time()
        print("Adding origine_etnica and seconda_generazione columns to privati_2023...")
        await conn.execute("ALTER TABLE privati_2023 ADD COLUMN IF NOT EXISTS origine_etnica TEXT;")
        await conn.execute("ALTER TABLE privati_2023 ADD COLUMN IF NOT EXISTS seconda_generazione BOOLEAN DEFAULT FALSE;")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_privati_2023_cognome_btree ON privati_2023(cognome);")
        
        print("Ensuring surname_onomastic_mapping lookup table is populated...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS surname_onomastic_mapping (
                cognome_clean TEXT PRIMARY KEY,
                origine_etnica TEXT NOT NULL,
                confidence FLOAT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_som_origine ON surname_onomastic_mapping(origine_etnica);
        """)
        
        # Check if surname_onomastic_mapping is empty; if so, populate from onomastic_mapping
        som_count = await conn.fetchval("SELECT count(*) FROM surname_onomastic_mapping;")
        if som_count == 0:
            print("Populating surname_onomastic_mapping from onomastic_mapping...")
            await conn.execute("""
                INSERT INTO surname_onomastic_mapping (cognome_clean, origine_etnica, confidence)
                SELECT DISTINCT ON (cognome_clean)
                    cognome_clean,
                    origine_etnica,
                    confidence
                FROM onomastic_mapping
                WHERE cognome_clean IS NOT NULL AND cognome_clean != ''
                ORDER BY cognome_clean, confidence DESC
                ON CONFLICT (cognome_clean) DO UPDATE SET
                    origine_etnica = EXCLUDED.origine_etnica,
                    confidence = EXCLUDED.confidence;
            """)
            print("✅ surname_onomastic_mapping populated.")

        print("Populating foreign and diverse origins in privati_2023 in chunked clusters...")
        foreign_clusters = [
            'CINESE', 'BRASILIANO_PORTOGHESE', 'TEDESCO_GERMANICO', 
            'ISPANO_LATINO', 'SLAVO_EST_EUROPEO', 'ARABO_MEDIO_ORIENTE', 'ALTRO_ESTERO'
        ]
        
        for cluster in foreign_clusters:
            t_cluster = time.time()
            res = await conn.execute(f"""
                UPDATE privati_2023 p
                SET origine_etnica = o.origine_etnica
                FROM surname_onomastic_mapping o
                WHERE p.cognome = o.cognome_clean
                  AND o.origine_etnica = '{cluster}'
                  AND p.origine_etnica IS DISTINCT FROM o.origine_etnica;
            """)
            print(f"   ➔ Cluster {cluster}: {res} ({round(time.time() - t_cluster, 2)}s)")

        # Update remaining unclassified Italian surnames
        t_it = time.time()
        res_it = await conn.execute("""
            UPDATE privati_2023 p
            SET origine_etnica = 'ITALIANO'
            FROM surname_onomastic_mapping o
            WHERE p.cognome = o.cognome_clean
              AND o.origine_etnica = 'ITALIANO'
              AND (p.origine_etnica IS NULL OR p.origine_etnica = '');
        """)
        print(f"   ➔ Populated Italian origin for unclassified: {res_it} ({round(time.time() - t_it, 2)}s)")

        # Retain existing classifications; do NOT default unmatched rows to 'ITALIANO'!
        # For unmatched non-empty cognomes, mark as 'ALTRO'
        res2 = await conn.execute("""
            UPDATE privati_2023
            SET origine_etnica = 'ALTRO'
            WHERE (origine_etnica IS NULL OR origine_etnica = '')
              AND cognome IS NOT NULL AND TRIM(cognome) != '';
        """)
        print(f"   ➔ Preserved diversity, set unmatched non-empty cognome to ALTRO: {res2}")

        print("Splitting any concatenated cognome strings in privati_2023...")
        res3 = await conn.execute("""
            UPDATE privati_2023 p
            SET cognome = o.cognome_clean,
                nome = COALESCE(NULLIF(p.nome, ''), o.nome_clean)
            FROM onomastic_mapping o
            WHERE p.cognome = o.raw_text 
              AND o.cognome_clean IS NOT NULL 
              AND o.cognome_clean != '' 
              AND o.cognome_clean != o.raw_text;
        """)
        print(f"   ➔ Split concatenated cognome: {res3}")

        print("Flagging seconda_generazione in privati_2023...")
        res4 = await conn.execute("""
            UPDATE privati_2023
            SET seconda_generazione = TRUE
            WHERE origine_etnica NOT IN ('ITALIANO', 'ALTRO_ESTERO', 'ALTRO')
              AND origine_etnica IS NOT NULL
              AND codice_fiscale IS NOT NULL
              AND LENGTH(codice_fiscale) >= 16
              AND SUBSTRING(codice_fiscale, 12, 1) NOT IN ('Z', 'z');
        """)
        print(f"   ➔ Flagged 2nd generation: {res4}")
        
        # Reset invalid 2nd generation flags
        res4_reset = await conn.execute("""
            UPDATE privati_2023
            SET seconda_generazione = FALSE
            WHERE seconda_generazione = TRUE
              AND (origine_etnica IN ('ITALIANO', 'ALTRO_ESTERO', 'ALTRO')
                   OR origine_etnica IS NULL
                   OR codice_fiscale IS NULL
                   OR LENGTH(codice_fiscale) < 16
                   OR SUBSTRING(codice_fiscale, 12, 1) IN ('Z', 'z'));
        """)
        print(f"   ➔ Reset non-2nd generation: {res4_reset}")

        print("Creating indexes on privati_2023 for fast search...")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_privati_2023_origine_etnica ON privati_2023(origine_etnica);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_privati_2023_seconda_gen ON privati_2023(seconda_generazione) WHERE seconda_generazione = TRUE;")
        print(f"✅ privati_2023 onomastic normalization completed in {round(time.time()-t0, 2)}s.")

        # PART 3: Onomastic Normalization (email_privati)
        print("\n--- 📧 PART 3: ONOMASTIC NORMALIZATION & 2nd GENERATION (email_privati) ---")
        t0 = time.time()
        print("Adding cognome_clean, nome_clean, origine_etnica, seconda_generazione columns to email_privati...")
        await conn.execute("ALTER TABLE email_privati ADD COLUMN IF NOT EXISTS cognome_clean TEXT;")
        await conn.execute("ALTER TABLE email_privati ADD COLUMN IF NOT EXISTS nome_clean TEXT;")
        await conn.execute("ALTER TABLE email_privati ADD COLUMN IF NOT EXISTS origine_etnica TEXT;")
        await conn.execute("ALTER TABLE email_privati ADD COLUMN IF NOT EXISTS seconda_generazione BOOLEAN DEFAULT FALSE;")

        print("Populating cognome_clean, nome_clean, origine_etnica from onomastic_mapping...")
        res_e1 = await conn.execute("""
            UPDATE email_privati e
            SET cognome_clean = o.cognome_clean,
                nome_clean = o.nome_clean,
                origine_etnica = o.origine_etnica
            FROM onomastic_mapping o
            WHERE e.cognome_e_nome = o.raw_text AND (e.cognome_clean IS NULL OR e.cognome_clean = '');
        """)
        print(f"   ➔ Populated clean names & origin: {res_e1}")

        res_e2 = await conn.execute("""
            UPDATE email_privati
            SET cognome_clean = cognome_e_nome,
                origine_etnica = 'ALTRO'
            WHERE cognome_clean IS NULL OR cognome_clean = '';
        """)
        print(f"   ➔ Marked remaining unmatched as ALTRO: {res_e2}")

        print("Flagging seconda_generazione in email_privati...")
        res_e3 = await conn.execute("""
            UPDATE email_privati
            SET seconda_generazione = TRUE
            WHERE origine_etnica NOT IN ('ITALIANO', 'ALTRO_ESTERO', 'ALTRO')
              AND cf IS NOT NULL
              AND LENGTH(cf) >= 16
              AND SUBSTRING(cf, 12, 1) NOT IN ('Z', 'z');
        """)
        print(f"   ➔ Flagged 2nd generation: {res_e3}")

        res_e3_reset = await conn.execute("""
            UPDATE email_privati
            SET seconda_generazione = FALSE
            WHERE seconda_generazione = TRUE
              AND (origine_etnica IN ('ITALIANO', 'ALTRO_ESTERO', 'ALTRO')
                   OR cf IS NULL
                   OR LENGTH(cf) < 16
                   OR SUBSTRING(cf, 12, 1) IN ('Z', 'z'));
        """)
        print(f"   ➔ Reset non-2nd generation in email_privati: {res_e3_reset}")

        print("Creating indexes on email_privati for fast search...")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_email_privati_cognome_clean ON email_privati(cognome_clean);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_email_privati_origine_etnica ON email_privati(origine_etnica);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_email_privati_seconda_gen ON email_privati(seconda_generazione) WHERE seconda_generazione = TRUE;")
        print(f"✅ email_privati onomastic normalization completed in {round(time.time()-t0, 2)}s.")

        # PART 4: Macro-region tables (nord_totale & censud_totale)
        print("\n--- 🗺️ PART 4: ONOMASTIC & 2nd GENERATION SYNC (nord_totale & censud_totale) ---")
        for macro_tbl, cf_col in [("nord_totale", "cf"), ("censud_totale", "cf")]:
            t_m = time.time()
            res_m1 = await conn.execute(f"""
                UPDATE {macro_tbl}
                SET seconda_generazione = TRUE
                WHERE origine_etnica NOT IN ('ITALIANO', 'ALTRO_ESTERO', 'ALTRO')
                  AND {cf_col} IS NOT NULL
                  AND LENGTH({cf_col}) >= 16
                  AND SUBSTRING({cf_col}, 12, 1) NOT IN ('Z', 'z')
                  AND (seconda_generazione IS NULL OR seconda_generazione = FALSE);
            """)
            print(f"   ➔ [{macro_tbl}] Flagged 2nd generation: {res_m1} ({round(time.time()-t_m, 2)}s)")

        print("\n🏆 FULL DATABASE NORMALIZATION SUCCESSFUL! All tables standardized and indexed.")

    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
