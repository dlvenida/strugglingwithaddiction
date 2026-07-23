from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def run_migrations(engine: Engine) -> None:
    insp = inspect(engine)
    if "posts" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("posts")}
        with engine.begin() as conn:
            if "deleted_at" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMPTZ"))
            if "content_json" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN content_json TEXT"))
            if "visibility_password_hash" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN visibility_password_hash VARCHAR(255)"))
            if "meta_title" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN meta_title VARCHAR(255)"))
            if "meta_description" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN meta_description VARCHAR(512)"))
            if "focus_keyword" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN focus_keyword VARCHAR(100)"))
            if "seo_noindex" not in cols:
                conn.execute(text("ALTER TABLE posts ADD COLUMN seo_noindex BOOLEAN NOT NULL DEFAULT FALSE"))
            # Add 'private' to poststatus enum if missing (Postgres)
            try:
                conn.execute(text("ALTER TYPE poststatus ADD VALUE IF NOT EXISTS 'private'"))
            except Exception:
                try:
                    conn.execute(text("ALTER TYPE poststatus ADD VALUE 'private'"))
                except Exception:
                    pass

    if "rehab_centers" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("rehab_centers")}
        with engine.begin() as conn:
            if "published_at" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN published_at TIMESTAMPTZ"))
            if "deleted_at" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN deleted_at TIMESTAMPTZ"))
            for col, ddl in [
                ("contact_email", "VARCHAR(255)"),
                ("outreach_email", "VARCHAR(255)"),
                ("outreach_unsubscribed_at", "TIMESTAMPTZ"),
                ("samhsa_id", "VARCHAR(64)"),
                ("google_maps_url", "VARCHAR(512)"),
                ("google_reviews_url", "VARCHAR(512)"),
                ("video_url", "VARCHAR(512)"),
            ]:
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE rehab_centers ADD COLUMN {col} {ddl}"))
            if "gallery_keys" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN gallery_keys JSONB DEFAULT '[]'::jsonb"))
            if "testimonials" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN testimonials JSONB DEFAULT '[]'::jsonb"))
            for col in ("insurances", "levels_of_care", "amenities", "accreditations"):
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE rehab_centers ADD COLUMN {col} VARCHAR[] DEFAULT '{{}}'"))
            if "cert_verified_at" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN cert_verified_at TIMESTAMPTZ"))
            if "verified_badge" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN verified_badge BOOLEAN NOT NULL DEFAULT FALSE"))
            if "featured_until" not in cols:
                conn.execute(text("ALTER TABLE rehab_centers ADD COLUMN featured_until TIMESTAMPTZ"))
            try:
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_rehab_centers_samhsa_id ON rehab_centers (samhsa_id)"))
            except Exception:
                pass

    if "user_profiles" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("user_profiles")}
        if "notification_preferences" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE user_profiles ADD COLUMN notification_preferences JSONB DEFAULT '{}'::jsonb"))

    if "rehab_center_claims" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("rehab_center_claims")}
        with engine.begin() as conn:
            for col, ddl in [
                ("email_domain_matched", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("phone_verified_at", "TIMESTAMPTZ"),
                ("phone_otp_hash", "VARCHAR(255)"),
                ("phone_otp_expires_at", "TIMESTAMPTZ"),
                ("cert_verified_at", "TIMESTAMPTZ"),
                ("reminder_sent_at", "TIMESTAMPTZ"),
            ]:
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE rehab_center_claims ADD COLUMN {col} {ddl}"))
            for value in ("certified", "abandoned"):
                try:
                    conn.execute(text(f"ALTER TYPE claimstatus ADD VALUE IF NOT EXISTS '{value}'"))
                except Exception:
                    try:
                        conn.execute(text(f"ALTER TYPE claimstatus ADD VALUE '{value}'"))
                    except Exception:
                        pass
