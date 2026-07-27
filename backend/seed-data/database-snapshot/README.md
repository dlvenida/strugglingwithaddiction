# Shared local database snapshot

Sanitized copy of the SWA Postgres data for local development.

## Load on your machine

```bash
./scripts/load-local-database.sh
```

Or manually:

```bash
docker compose up -d postgres
cd backend && source .venv/bin/activate
export DATABASE_URL=postgresql://swa:swa_dev_password@localhost:5433/swa
python scripts/import_database_snapshot.py
```

Stripe IDs and email provider secrets are cleared. Password hashes are kept.
