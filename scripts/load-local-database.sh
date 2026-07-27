#!/usr/bin/env bash
# Load the shared GitHub database snapshot into local Docker Postgres.
# Usage (from repo root):
#   ./scripts/load-local-database.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f backend/seed-data/database-snapshot/manifest.json ]]; then
  echo "Missing backend/seed-data/database-snapshot/ — pull latest main/branch first."
  exit 1
fi

echo "==> Starting Postgres (docker compose)"
docker compose up -d postgres

echo "==> Waiting for Postgres on localhost:5433"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U swa -d swa >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker compose exec -T postgres pg_isready -U swa -d swa

echo "==> Ensuring backend/.env points at local Docker DB"
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
fi
# Prefer the compose URL for local loads (do not overwrite unrelated keys).
if ! grep -q 'localhost:5433' backend/.env 2>/dev/null; then
  echo "Note: backend/.env DATABASE_URL should be postgresql://swa:swa_dev_password@localhost:5433/swa"
fi

echo "==> Installing backend deps (if needed) and importing snapshot"
cd backend
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt
export DATABASE_URL="${DATABASE_URL:-postgresql://swa:swa_dev_password@localhost:5433/swa}"
python scripts/import_database_snapshot.py

echo
echo "Database loaded."
echo "Start API:  cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "Default admin (if present): admin@example.com / changeme123"
