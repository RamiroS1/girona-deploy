"""
Carga de ítems del recetario de bar (RECETARIO BAR.pdf → recetario_bar.json).

- Se aplica al final de `app.seed_girona_data` si el JSON está presente.
- Uso aislado (sin resembrar todo el Excel):

  cd girona-back
  export DATABASE_URL=...
  python -m app.recetario_bar_seed
"""
from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import db, models

RECETARIO_JSON = Path(__file__).resolve().parent / "recetario_bar.json"


def _attach_recipe_for_menu_item(db_session: Session, menu_item_id: int) -> bool:
    """Crea fila Recipe si no existe (necesaria para la pestaña Inventario → Recetas)."""
    exists = (
        db_session.query(models.Recipe)
        .filter(models.Recipe.menu_item_id == menu_item_id)
        .first()
    )
    if exists:
        return False
    db_session.add(
        models.Recipe(
            menu_item_id=menu_item_id,
            yield_quantity=Decimal("1"),
            unit="porcion",
            notes="Recetario bar",
        )
    )
    return True


def _read_entries() -> list[dict[str, Any]]:
    if not RECETARIO_JSON.is_file():
        return []
    raw = json.loads(RECETARIO_JSON.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        return []
    return [x for x in raw if isinstance(x, dict)]


def apply_recetario_bar_items(db_session: Session) -> int:
    """
    Inserta filas de recetario_bar.json que aún no existen (mismo criterio de nombre
    que en seed_girona_data para el bar de menu_escrito).
    """
    entries = _read_entries()
    if not entries:
        return 0
    added = 0
    for entry in entries:
        name = (entry.get("name") or "").strip()
        if not name:
            continue
        category = (entry.get("category") or "Bebidas").strip() or "Bebidas"
        dup = (
            db_session.query(models.MenuItem)
            .filter(func.lower(models.MenuItem.name) == name.lower())
            .first()
        )
        if dup:
            continue
        price = entry.get("price")
        if price is not None and price != "":
            try:
                p = Decimal(str(price))
            except Exception:
                p = Decimal("10000")
        else:
            p = Decimal("10000")
        desc = entry.get("description")
        ings = entry.get("ingredients")
        if ings is not None and not isinstance(ings, list):
            ings = None
        m = models.MenuItem(
            name=name,
            category=category,
            price=p,
            description=desc if isinstance(desc, str) else None,
            ingredients=ings,
            is_active=True,
        )
        db_session.add(m)
        db_session.flush()
        _attach_recipe_for_menu_item(db_session, m.id)
        added += 1
    return added


def sync_recetario_bar_recipes(db_session: Session) -> dict[str, int]:
    """
    Asegura una fila `Recipe` por cada nombre en recetario_bar.json (ítems ya existentes
    en menú, p. ej. insertados antes de esta vinculación).

    Devuelve contadores para interpretar un ``linked_new`` de 0 (¿ya todo enlazado o BD distinta?).
    """
    entries = _read_entries()
    stats = {
        "linked_new": 0,
        "already_linked": 0,
        "no_menu_item": 0,
        "json_names": 0,
    }
    if not entries:
        return stats
    # Evita INSERT duplicados en mismo flush si hay nombres JSON distintos que resuelven al mismo ítem (.first()) ambiguos.
    pending_recipe_mi: set[int] = set()
    for entry in entries:
        name = (entry.get("name") or "").strip()
        if not name:
            continue
        stats["json_names"] += 1
        m = (
            db_session.query(models.MenuItem)
            .filter(func.lower(models.MenuItem.name) == name.lower())
            .order_by(models.MenuItem.id)
            .first()
        )
        if not m:
            stats["no_menu_item"] += 1
            continue
        has_recipe = (
            db_session.query(models.Recipe)
            .filter(models.Recipe.menu_item_id == m.id)
            .first()
        )
        if has_recipe or m.id in pending_recipe_mi:
            stats["already_linked"] += 1
            continue
        pending_recipe_mi.add(m.id)
        db_session.add(
            models.Recipe(
                menu_item_id=m.id,
                yield_quantity=Decimal("1"),
                unit="porcion",
                notes="Recetario bar",
            )
        )
        stats["linked_new"] += 1
    return stats


def main() -> None:
    session = db.SessionLocal()
    try:
        n = apply_recetario_bar_items(session)
        # Para que sync vea Recipes recién ligados desde apply antes de consultas ORM nuevas.
        session.flush()
        s = sync_recetario_bar_recipes(session)
        session.commit()
        print(
            f"Recetario bar: {n} ítems nuevos en menú | "
            f"recetas nuevas: {s['linked_new']}, "
            f"ya enlazadas: {s['already_linked']}, "
            f"sin ítem en menú (nombre JSON): {s['no_menu_item']} "
            f"| nombres en JSON: {s['json_names']} | {RECETARIO_JSON}"
        )
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
