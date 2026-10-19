import os
#!/usr/bin/env python3
import asyncio
import asyncpg
import time

DB_DSN = os.getenv("DATABASE_URL", "postgresql://postgres:your_password@localhost:5432/bigdata_db")

async def main():
    print("🚀 Connecting to bigdata_db to clean reference tables...")
    conn = await asyncpg.connect(DB_DSN)
    await conn.execute("SET statement_timeout = 0;")
    
    try:
        t0 = time.time()
        
        # 1. Purge comuni
        print("🧹 1. Purging corrupt Codici Fiscali, numbers, and street addresses from 'comuni'...")
        res_comuni = await conn.execute("""
            DELETE FROM comuni 
            WHERE (citta ~ '[0-9]' 
               OR citta ~ '^[A-Z0-9]{16}$' 
               OR citta ~* '\\mvia\\M' 
               OR citta ~* '^(corso|viale|vicolo|largo|piazza caduti)\\M'
               OR citta ILIKE '% - VIA %'
               OR citta ILIKE '%ANGOLO VIA%')
              AND citta NOT IN (
                'PAVIA', 'PAVIA DI UDINE', 'Pavia D''Udine', 'PAVIA UDINE', 'PAVIA IA', 
                'PAVIA LOMBARDIA', 'PAVIA (PAVIA) LOMBARDIA', 'PIAZZA ARMERINA', 'Piazza Armerina', 
                'PIAZZA AL SERCHIO', 'Piazza al Serchio', 'PIAZZA BREMBANA', 'PIAZZA SERCHIO LU', 
                'SANTA FLAVIA (PA)', 'ARCEVIA (ANCONA) MARCHE'
              );
        """)
        print(f"   ➔ Result: {res_comuni}")

        # 2. Purge comune_mapping
        print("🧹 2. Purging corrupt Codici Fiscali, numbers, and street addresses from 'comune_mapping'...")
        res_mapping = await conn.execute("""
            DELETE FROM comune_mapping 
            WHERE (raw_name ~ '[0-9]' 
               OR raw_name ~ '^[A-Z0-9]{16}$' 
               OR raw_name ~* '\\mvia\\M' 
               OR raw_name ~* '^(corso|viale|vicolo|largo|piazza caduti)\\M'
               OR canonical_name ~ '[0-9]'
               OR canonical_name ~ '^[A-Z0-9]{16}$'
               OR canonical_name ~* '\\mvia\\M'
               OR canonical_name ~* '^(corso|viale|vicolo|largo|piazza caduti)\\M')
              AND canonical_name NOT IN (
                'PAVIA', 'PAVIA DI UDINE', 'PIAZZA ARMERINA', 'PIAZZA AL SERCHIO', 'PIAZZA BREMBANA', 
                'SANTA FLAVIA', 'ARCEVIA', 'SOMMA VESUVIANA', 'CURIGLIA CON MONTEVIASCO', 'NEVIANO', 
                'RUVIANO', 'VIALFRE', 'CARBONARA SCRIVIA', 'CERTOSA DI PAVIA', 'CASSANO VALCUVIA'
              );
        """)
        print(f"   ➔ Result: {res_mapping}")

        # 3. Purge onomastic_mapping
        print("🧹 3. Purging test garbage, pure numbers, and streets from 'onomastic_mapping'...")
        res_onomastic = await conn.execute("""
            DELETE FROM onomastic_mapping 
            WHERE raw_text ~ '^[0-9]+$' 
               OR raw_text ILIKE '%AAAAA%' 
               OR raw_text ~* '\\mvia\\M'
               OR raw_text ~* '^(corso|viale|vicolo|largo)\\M';
        """)
        print(f"   ➔ Result: {res_onomastic}")

        dt = round(time.time() - t0, 2)
        print(f"✅ Reference tables purified successfully in {dt}s!")
        
        # Verify comuni post-purge
        rem_cf = await conn.fetchval("SELECT count(*) FROM comuni WHERE citta ~ '^[A-Z0-9]{16}$';")
        rem_num = await conn.fetchval("SELECT count(*) FROM comuni WHERE citta ~ '[0-9]';")
        print(f"🔍 Verification: comuni with CF remaining: {rem_cf}, with digits remaining: {rem_num}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
