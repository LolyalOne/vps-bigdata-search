\timing on
\echo "Starting index creation on privati_2023..."
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_privati_2023_provincia_btree ON privati_2023(provincia);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_privati_2023_comune_btree ON privati_2023(comune);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_privati_2023_annon_btree ON privati_2023(annon);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_privati_2023_cap_btree ON privati_2023(cap);

\echo "Starting index creation on aziende_2023..."
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aziende_2023_provincia_btree ON aziende_2023(provincia);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aziende_2023_comune_btree ON aziende_2023(comune);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aziende_2023_categoria_btree ON aziende_2023(categoria);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aziende_2023_cap_btree ON aziende_2023(cap);

\echo "Starting index creation on nord_totale..."
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nord_totale_prov_btree ON nord_totale(prov);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nord_totale_citta_btree ON nord_totale(citta);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nord_totale_annon_btree ON nord_totale(annon);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nord_totale_cap_btree ON nord_totale(cap);

\echo "Starting index creation on censud_totale..."
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_censud_totale_prov_btree ON censud_totale(prov);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_censud_totale_citta_btree ON censud_totale(citta);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_censud_totale_annon_btree ON censud_totale(annon);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_censud_totale_cap_btree ON censud_totale(cap);
\echo "All indexes completed successfully!"
