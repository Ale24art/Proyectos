#!/usr/bin/env bash
# dump_db.sh — Exporta la base de datos Moodle al repositorio.
# Uso: ./dump_db.sh [nombre_db] [usuario_db]
# La contraseña se pide de forma interactiva para no quedar en el historial.

set -euo pipefail

DB_NAME="${1:-moodle}"
DB_USER="${2:-moodleuser}"
OUT_FILE="$(dirname "$0")/db/moodle_dump.sql"

mkdir -p "$(dirname "$OUT_FILE")"

echo "==> Exportando base de datos '$DB_NAME' como usuario '$DB_USER' ..."
echo -n "Contraseña de MariaDB: "
read -rs DB_PASS
echo

mysqldump \
  --user="$DB_USER" \
  --password="$DB_PASS" \
  --host=localhost \
  --single-transaction \
  --routines \
  --triggers \
  --add-drop-table \
  "$DB_NAME" > "$OUT_FILE"

LINES=$(wc -l < "$OUT_FILE")
SIZE=$(du -sh "$OUT_FILE" | cut -f1)
echo "==> Dump completado: $SIZE ($LINES líneas) -> $OUT_FILE"
echo "==> Recuerda hacer: git add db/moodle_dump.sql && git commit"
