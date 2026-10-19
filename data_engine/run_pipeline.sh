#!/usr/bin/env bash
set -eo pipefail

VENV_PY="/usr/bin/env python3"
ENGINE_DIR="/root/data_engine"

echo "============================================================"
echo "🚀 DATA ENGINE NORMALIZATION PIPELINE"
echo "Python binary: $VENV_PY"
echo "Working directory: $ENGINE_DIR"
echo "Timestamp: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "============================================================"

# Verify python binary has asyncpg
if ! "$VENV_PY" -c "import asyncpg" &>/dev/null; then
    echo "❌ Error: asyncpg not available in $VENV_PY"
    exit 1
fi
echo "✅ Python environment and asyncpg verified."

echo ""
echo "▶️ [Step 1/5] Purifying reference tables (comuni, comune_mapping, onomastic_mapping)..."
"$VENV_PY" "$ENGINE_DIR/clean_reference_tables.py"

echo ""
echo "▶️ [Step 2/5] Standardizing Italian municipalities..."
"$VENV_PY" "$ENGINE_DIR/comune_standardizer.py"

echo ""
echo "▶️ [Step 3/5] Expanding province codes across database tables..."
"$VENV_PY" "$ENGINE_DIR/expand_provinces_db.py"

echo ""
echo "▶️ [Step 4/6] Classifying surnames and onomastic origins..."
"$VENV_PY" "$ENGINE_DIR/onomastic_classifier.py"

echo ""
echo "▶️ [Step 5/6] Refreshing surname onomastic mapping..."
"$VENV_PY" "$ENGINE_DIR/populate_surname_mapping.py"

echo ""
echo "▶️ [Step 6/6] Normalizing full database (comuni, province, origins, 2nd generation)..."
"$VENV_PY" "$ENGINE_DIR/normalize_database.py"

echo ""
echo "============================================================"
echo "🏆 DATA ENGINE PIPELINE COMPLETED SUCCESSFULLY"
echo "Timestamp: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "============================================================"
