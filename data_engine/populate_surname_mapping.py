import os
#!/usr/bin/env python3
import asyncio
import asyncpg
import time

DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:your_password@localhost:5432/bigdata_db")

async def main():
    print("🚀 Connecting to populate surname_onomastic_mapping...")
    conn = await asyncpg.connect(DB_DSN)
    await conn.execute("SET statement_timeout = 0;")
    
    try:
        t0 = time.time()
        print("Creating table surname_onomastic_mapping if not exists...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS surname_onomastic_mapping (
                cognome_clean TEXT PRIMARY KEY,
                origine_etnica TEXT NOT NULL,
                confidence FLOAT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_som_origine ON surname_onomastic_mapping(origine_etnica);
        """)
        
        print("Populating surname_onomastic_mapping from onomastic_mapping...")
        res = await conn.execute("""
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
        dt = round(time.time() - t0, 2)
        print(f"✅ surname_onomastic_mapping populated: {res} in {dt}s!")
        
        cnt = await conn.fetchval("SELECT count(*) FROM surname_onomastic_mapping;")
        print(f"📊 Total unique surnames classified: {cnt}")
        
        stats = await conn.fetch("SELECT origine_etnica, count(*) as cnt FROM surname_onomastic_mapping GROUP BY origine_etnica ORDER BY cnt DESC;")
        for s in stats:
            print(f"   {s['origine_etnica']}: {s['cnt']}")
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
