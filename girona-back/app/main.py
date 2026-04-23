import os
import logging

from fastapi import FastAPI
from sqlalchemy.exc import OperationalError
from sqlalchemy import text
from . import auth, db, factus, inventory, menu, models, personnel, pos, reservations, sales

app = FastAPI()

logger = logging.getLogger("uvicorn.error")

def _auto_migrate_schema() -> None:
    if os.getenv("AUTO_MIGRATE_SCHEMA", "1") != "1":
        return
    try:
        with db.engine.begin() as conn:
            if conn.dialect.name == "sqlite":
                table_exists = conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table' AND name='pos_tables'")
                ).first()
                if table_exists:
                    columns = {
                        str(row[1])
                        for row in conn.execute(text("PRAGMA table_info(pos_tables)")).fetchall()
                    }
                    if "section" not in columns:
                        conn.execute(
                            text(
                                "ALTER TABLE pos_tables "
                                "ADD COLUMN section VARCHAR NOT NULL DEFAULT 'ZONA PRINCIPAL'"
                            )
                        )
                pos_orders_exists = conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table' AND name='pos_orders'")
                ).first()
                if pos_orders_exists:
                    pos_order_columns = {
                        str(row[1])
                        for row in conn.execute(text("PRAGMA table_info(pos_orders)")).fetchall()
                    }
                    if "utility_total" not in pos_order_columns:
                        conn.execute(
                            text(
                                "ALTER TABLE pos_orders "
                                "ADD COLUMN utility_total NUMERIC(14, 2) NOT NULL DEFAULT 0"
                            )
                        )
                sales_exists = conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'")
                ).first()
                if sales_exists:
                    sales_columns = {
                        str(row[1])
                        for row in conn.execute(text("PRAGMA table_info(sales)")).fetchall()
                    }
                    if "utility_total" not in sales_columns:
                        conn.execute(
                            text(
                                "ALTER TABLE sales "
                                "ADD COLUMN utility_total NUMERIC(14, 2) NOT NULL DEFAULT 0"
                            )
                        )
                    if "payment_method" not in sales_columns:
                        conn.execute(
                            text("ALTER TABLE sales ADD COLUMN payment_method VARCHAR(32)")
                        )
                reservations_exists = conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table' AND name='reservations'")
                ).first()
                if reservations_exists:
                    reservations_columns = {
                        str(row[1])
                        for row in conn.execute(text("PRAGMA table_info(reservations)")).fetchall()
                    }
                    if "google_event_id" not in reservations_columns:
                        conn.execute(
                            text(
                                "ALTER TABLE reservations "
                                "ADD COLUMN google_event_id VARCHAR"
                            )
                        )
                return
            conn.execute(text("ALTER TABLE IF EXISTS inventory_products ALTER COLUMN unit DROP NOT NULL"))
            conn.execute(text("ALTER TABLE IF EXISTS inventory_products DROP COLUMN IF EXISTS reorder_point"))
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS menu_items "
                    "ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )
            conn.execute(
                text("ALTER TABLE IF EXISTS menu_items DROP COLUMN IF EXISTS image_url")
            )
            conn.execute(text("ALTER TABLE IF EXISTS suppliers DROP COLUMN IF EXISTS email"))
            conn.execute(text("ALTER TABLE IF EXISTS suppliers DROP COLUMN IF EXISTS notes"))
            conn.execute(text("ALTER TABLE IF EXISTS purchases DROP COLUMN IF EXISTS invoice_number"))
            conn.execute(
                text("ALTER TABLE IF EXISTS purchase_items ADD COLUMN IF NOT EXISTS supplier_id INTEGER")
            )
            conn.execute(
                text("ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS customer_id INTEGER")
            )
            conn.execute(
                text("ALTER TABLE IF EXISTS pos_orders ADD COLUMN IF NOT EXISTS waiter_id INTEGER")
            )
            conn.execute(
                text("ALTER TABLE IF EXISTS sales ADD COLUMN IF NOT EXISTS waiter_id INTEGER")
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS suppliers "
                    "ADD COLUMN IF NOT EXISTS gender VARCHAR NOT NULL DEFAULT 'male'"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS waiters "
                    "ADD COLUMN IF NOT EXISTS gender VARCHAR NOT NULL DEFAULT 'male'"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS customers "
                    "ADD COLUMN IF NOT EXISTS gender VARCHAR NOT NULL DEFAULT 'male'"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS recipes "
                    "ADD COLUMN IF NOT EXISTS unit VARCHAR"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS users "
                    "ADD COLUMN IF NOT EXISTS full_name VARCHAR"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS users "
                    "ADD COLUMN IF NOT EXISTS profile_photo_url TEXT"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS pos_tables "
                    "ADD COLUMN IF NOT EXISTS section VARCHAR NOT NULL DEFAULT 'ZONA PRINCIPAL'"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS pos_orders "
                    "ADD COLUMN IF NOT EXISTS utility_total NUMERIC(14, 2) NOT NULL DEFAULT 0"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS sales "
                    "ADD COLUMN IF NOT EXISTS utility_total NUMERIC(14, 2) NOT NULL DEFAULT 0"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS sales "
                    "ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32)"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS reservations "
                    "DROP CONSTRAINT IF EXISTS uq_reservations_date"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS reservations "
                    "ADD COLUMN IF NOT EXISTS google_event_id VARCHAR"
                )
            )
    except Exception as exc:
        logger.warning("Auto-migration skipped/failed: %s", exc)


@app.on_event("startup")
def _init_db() -> None:
    if os.getenv("AUTO_CREATE_TABLES", "1") != "1":
        return
    try:
        models.Base.metadata.create_all(bind=db.engine)
        _auto_migrate_schema()
    except OperationalError as exc:
        database_url = os.getenv("DATABASE_URL", "DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/girona_dev")
        logger.error("Database connection failed. Check DATABASE_URL and Postgres auth.")
        logger.error("DATABASE_URL=%s", database_url)
        if database_url.startswith("postgresql:///") or database_url.startswith("postgres:///"):
            logger.error(
                "Hint: this URL uses a local Unix socket; ensure Postgres is running locally (socket like /var/run/postgresql/.s.PGSQL.5432)."
            )
        logger.error("%s", exc)
        raise

app.include_router(auth.router)
app.include_router(menu.router)
app.include_router(inventory.router)
app.include_router(personnel.router)
app.include_router(pos.router)
app.include_router(sales.router)
app.include_router(reservations.router)
app.include_router(factus.router)
