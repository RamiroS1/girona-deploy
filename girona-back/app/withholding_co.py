"""Retención en la fuente (Colombia) — umbrales y tasas para compras vs servicios."""

from __future__ import annotations

from decimal import Decimal
from typing import Literal

WithholdingOperation = Literal["purchase", "service"]

# Valores de referencia (COP, sin decimales)
THRESHOLD_PURCHASE = Decimal("524000")
THRESHOLD_SERVICE = Decimal("105000")


def effective_income_tax_declarant(tax_regime: str | None, income_tax_declarant: bool | None) -> bool:
    """Régimen común: se asume declarante; persona natural: usa el indicador guardado."""
    regime = (tax_regime or "common").strip().lower()
    if regime == "natural":
        return bool(income_tax_declarant)
    return True


def withholding_rate_fraction(operation: WithholdingOperation, declarant: bool) -> Decimal:
    if operation == "purchase":
        return Decimal("0.025") if declarant else Decimal("0.035")
    return Decimal("0.040") if declarant else Decimal("0.060")


def compute_withholding_source(
    total_cop: Decimal,
    operation: WithholdingOperation,
    declarant: bool,
    custom_percent: Decimal | None = None,
) -> tuple[Decimal | None, Decimal | None]:
    """
    Retorna (tasa como fracción, monto retenido en COP) o (None, None) si no aplica.

    Si ``custom_percent`` no es None, es el porcentaje nominal (p. ej. 2.5 = 2,5 %)
    y se usa la misma base umbral según compra/servicio; si es None, aplican las tasas legales por declarante.
    """
    total = total_cop.quantize(Decimal("1"))
    threshold = THRESHOLD_PURCHASE if operation == "purchase" else THRESHOLD_SERVICE
    if total < threshold:
        return None, None
    if custom_percent is not None:
        rate = (custom_percent / Decimal("100")).quantize(Decimal("0.000001"))
        amount = (total * rate).quantize(Decimal("1"))
        return rate, amount
    rate = withholding_rate_fraction(operation, declarant)
    amount = (total * rate).quantize(Decimal("1"))
    return rate, amount
