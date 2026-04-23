from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from . import db, models, schemas

router = APIRouter(prefix="/sales", tags=["sales"])

CO_TZ = ZoneInfo("America/Bogota")


def _day_bounds_utc(yyyy_mm_dd: str) -> tuple[datetime, datetime]:
    """Rango [inicio, fin) del día en America/Bogota, en UTC, para filtrar `created_at`."""
    try:
        d = date.fromisoformat(yyyy_mm_dd.strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="Fecha invalida, use formato YYYY-MM-DD"
        ) from exc
    start_local = datetime.combine(d, time.min, tzinfo=CO_TZ)
    end_local = start_local + timedelta(days=1)
    return (start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc))


def _range_bounds_utc(d_from: str, d_to: str) -> tuple[datetime, datetime]:
    """Rango [inicio, fin) en UTC para filtrar ventas por dias calendario en America/Bogota."""
    try:
        d0 = date.fromisoformat(d_from.strip())
        d1 = date.fromisoformat(d_to.strip())
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail="Fecha invalida, use formato YYYY-MM-DD"
        ) from exc
    if d0 > d1:
        d0, d1 = d1, d0
    start_local = datetime.combine(d0, time.min, tzinfo=CO_TZ)
    end_exclusive = datetime.combine(d1 + timedelta(days=1), time.min, tzinfo=CO_TZ)
    return (start_local.astimezone(timezone.utc), end_exclusive.astimezone(timezone.utc))


def _period_start(period: str | None) -> datetime | None:
    if not period:
        return None
    if period == "all":
        return None
    days_by_period = {
        "week": 7,
        "month": 30,
        "quarter": 90,
        "year": 365,
    }
    days = days_by_period.get(period)
    if days is None:
        raise HTTPException(
            status_code=400,
            detail="Periodo invalido. Usa: all, week, month, quarter, year",
        )
    return datetime.now(timezone.utc) - timedelta(days=days)


@router.get("", response_model=list[schemas.SaleOut])
def list_sales(
    period: str | None = None,
    on_date: str | None = None,
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    db_session: Session = Depends(db.get_db),
):
    query = db_session.query(models.Sale)
    use_wide_limit = False
    if date_from and str(date_from).strip() and date_to and str(date_to).strip():
        use_wide_limit = True
        start_utc, end_utc = _range_bounds_utc(str(date_from), str(date_to))
        query = query.filter(
            models.Sale.created_at >= start_utc,
            models.Sale.created_at < end_utc,
        )
    elif on_date and str(on_date).strip():
        start_utc, end_utc = _day_bounds_utc(str(on_date))
        query = query.filter(
            models.Sale.created_at >= start_utc,
            models.Sale.created_at < end_utc,
        )
    else:
        start_date = _period_start(period)
        if start_date is not None:
            query = query.filter(models.Sale.created_at >= start_date)
    limit = 5000 if use_wide_limit else 500
    return query.order_by(models.Sale.id.desc()).limit(limit).all()


@router.get("/{sale_id}", response_model=schemas.SaleOut)
def get_sale(sale_id: int, db_session: Session = Depends(db.get_db)):
    sale = db_session.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return sale


@router.get("/summary/products", response_model=list[schemas.SalesByProductOut])
def sales_by_product(period: str | None = None, db_session: Session = Depends(db.get_db)):
    start_date = _period_start(period)
    query = (
        db_session.query(
            models.SaleItem.menu_item_id,
            models.SaleItem.name,
            models.SaleItem.category,
            func.coalesce(func.sum(models.SaleItem.quantity), 0).label("quantity"),
            func.coalesce(func.sum(models.SaleItem.line_total), 0).label("total"),
        )
        .join(models.Sale, models.Sale.id == models.SaleItem.sale_id)
        .group_by(models.SaleItem.menu_item_id, models.SaleItem.name, models.SaleItem.category)
        .order_by(func.sum(models.SaleItem.line_total).desc())
    )
    if start_date is not None:
        query = query.filter(models.Sale.created_at >= start_date)
    rows = query.all()
    return [
        schemas.SalesByProductOut(
            menu_item_id=row.menu_item_id,
            name=row.name,
            category=row.category,
            quantity=row.quantity,
            total=row.total,
        )
        for row in rows
    ]


@router.get("/summary/categories", response_model=list[schemas.SalesByCategoryOut])
def sales_by_category(
    period: str | None = None,
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    db_session: Session = Depends(db.get_db),
):
    query = (
        db_session.query(
            models.SaleItem.category,
            func.coalesce(func.sum(models.SaleItem.quantity), 0).label("quantity"),
            func.coalesce(func.sum(models.SaleItem.line_total), 0).label("total"),
        )
        .join(models.Sale, models.Sale.id == models.SaleItem.sale_id)
        .group_by(models.SaleItem.category)
        .order_by(func.sum(models.SaleItem.line_total).desc())
    )
    if date_from and str(date_from).strip() and date_to and str(date_to).strip():
        start_utc, end_utc = _range_bounds_utc(str(date_from), str(date_to))
        query = query.filter(
            models.Sale.created_at >= start_utc,
            models.Sale.created_at < end_utc,
        )
    else:
        start_date = _period_start(period)
        if start_date is not None:
            query = query.filter(models.Sale.created_at >= start_date)
    rows = query.all()
    return [
        schemas.SalesByCategoryOut(category=row.category, quantity=row.quantity, total=row.total)
        for row in rows
    ]


@router.get("/summary/waiters", response_model=list[schemas.SalesByWaiterOut])
def sales_by_waiter(period: str | None = None, db_session: Session = Depends(db.get_db)):
    start_date = _period_start(period)
    query = (
        db_session.query(
            models.Sale.waiter_id,
            func.coalesce(models.Waiter.name, "Sin asignar").label("name"),
            func.coalesce(func.count(models.Sale.id), 0).label("quantity"),
            func.coalesce(func.sum(models.Sale.service_total), 0).label("service_total"),
            func.coalesce(func.sum(models.Sale.total), 0).label("total"),
        )
        .outerjoin(models.Waiter, models.Waiter.id == models.Sale.waiter_id)
        .group_by(models.Sale.waiter_id, models.Waiter.name)
        .order_by(func.sum(models.Sale.total).desc())
    )
    if start_date is not None:
        query = query.filter(models.Sale.created_at >= start_date)
    rows = query.all()
    return [
        schemas.SalesByWaiterOut(
            waiter_id=row.waiter_id,
            name=row.name,
            quantity=row.quantity,
            service_total=row.service_total,
            total=row.total,
        )
        for row in rows
    ]


@router.get("/summary/tables", response_model=list[schemas.SalesByTableOut])
def sales_by_table(period: str | None = None, db_session: Session = Depends(db.get_db)):
    start_date = _period_start(period)
    query = (
        db_session.query(
            models.PosOrder.table_id,
            models.PosTable.name,
            models.PosTable.is_active,
            func.coalesce(func.count(models.Sale.id), 0).label("quantity"),
            func.coalesce(func.sum(models.Sale.total), 0).label("total"),
        )
        .join(models.PosOrder, models.PosOrder.id == models.Sale.order_id)
        .outerjoin(models.PosTable, models.PosTable.id == models.PosOrder.table_id)
        .group_by(models.PosOrder.table_id, models.PosTable.name, models.PosTable.is_active)
        .order_by(func.sum(models.Sale.total).desc())
    )
    if start_date is not None:
        query = query.filter(models.Sale.created_at >= start_date)
    rows = query.all()
    return [
        schemas.SalesByTableOut(
            table_id=row.table_id,
            name=row.name,
            is_active=row.is_active,
            quantity=row.quantity,
            total=row.total,
        )
        for row in rows
    ]


@router.get("/summary/adjustments/monthly", response_model=list[schemas.SalesAdjustmentsByMonthOut])
def sales_adjustments_by_month(
    period: str | None = None,
    db_session: Session = Depends(db.get_db),
):
    start_date = _period_start(period)
    year_expr = func.extract("year", models.Sale.created_at)
    month_expr = func.extract("month", models.Sale.created_at)

    query = (
        db_session.query(
            year_expr.label("year"),
            month_expr.label("month"),
            func.coalesce(
                func.sum(case((models.PosOrderItem.courtesy.is_(True), 1), else_=0)),
                0,
            ).label("courtesy_count"),
            func.coalesce(
                func.sum(case((models.PosOrderItem.discount_amount > 0, 1), else_=0)),
                0,
            ).label("discount_count"),
        )
        .join(models.PosOrder, models.PosOrder.id == models.Sale.order_id)
        .outerjoin(models.PosOrderItem, models.PosOrderItem.order_id == models.PosOrder.id)
        .group_by(year_expr, month_expr)
        .order_by(year_expr.desc(), month_expr.desc())
    )
    if start_date is not None:
        query = query.filter(models.Sale.created_at >= start_date)
    rows = query.all()
    return [
        schemas.SalesAdjustmentsByMonthOut(
            year=int(row.year or 0),
            month=int(row.month or 0),
            courtesy_count=int(row.courtesy_count or 0),
            discount_count=int(row.discount_count or 0),
        )
        for row in rows
    ]
