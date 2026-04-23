"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useCallback, useEffect, useMemo, useState } from "react";

dayjs.extend(utc);
dayjs.extend(timezone);

const COLOMBIA_TZ = "America/Bogota";
const LS_PREFIX = "girona.cashClosing.";

type SaleRow = {
  id: number;
  total: number | string;
  subtotal: number | string;
  tax_total: number | string;
  service_total: number | string;
  courtesy_total: number | string;
  created_at: string;
  payment_method?: string | null;
};

const TARJETA_CODES = new Set(["tarjeta", "tarjeta_credito", "tarjeta_debito"]);

type PurchaseRow = {
  id: number;
  total_cost: number | string;
  created_at: string;
  items?: unknown[];
};

function safeNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(safeNumber(value));
}

function todayYmd() {
  return dayjs().tz(COLOMBIA_TZ).format("YYYY-MM-DD");
}

function purchaseOnDate(p: PurchaseRow, ymd: string) {
  const t = p.created_at;
  if (!t) return false;
  return dayjs(t).tz(COLOMBIA_TZ).format("YYYY-MM-DD") === ymd;
}

type Draft = {
  opening: string;
  cashIn: string;
  counted: string;
  note: string;
};

function loadDraft(ymd: string): Draft {
  if (typeof window === "undefined") {
    return { opening: "", cashIn: "", counted: "", note: "" };
  }
  try {
    const raw = window.localStorage.getItem(`${LS_PREFIX}${ymd}`);
    if (!raw) return { opening: "", cashIn: "", counted: "", note: "" };
    const p = JSON.parse(raw) as Partial<Draft>;
    return {
      opening: String(p.opening ?? ""),
      cashIn: String(p.cashIn ?? ""),
      counted: String(p.counted ?? ""),
      note: String(p.note ?? ""),
    };
  } catch {
    return { opening: "", cashIn: "", counted: "", note: "" };
  }
}

function saveDraft(ymd: string, d: Draft) {
  try {
    window.localStorage.setItem(`${LS_PREFIX}${ymd}`, JSON.stringify(d));
  } catch {
    // ignore
  }
}

function paymentLabel(code: string | null | undefined) {
  if (!code) return "—";
  const c = code.toLowerCase();
  const map: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    tarjeta_credito: "Tarjeta crédito",
    tarjeta_debito: "Tarjeta débito",
    transferencia: "Transferencia",
    billetera: "Billetera",
    otro: "Otro",
  };
  return map[c] ?? code;
}

export default function CashClosing() {
  const [dateInput, setDateInput] = useState(todayYmd);
  const [dateYmd, setDateYmd] = useState(todayYmd);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [purchasesDay, setPurchasesDay] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ opening: "", cashIn: "", counted: "", note: "" });

  useEffect(() => {
    setDraft(loadDraft(dateYmd));
  }, [dateYmd]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [salesRes, purRes] = await Promise.all([
        fetch(`/api/sales?on_date=${encodeURIComponent(dateYmd)}`, { cache: "no-store" }),
        fetch("/api/inventory/purchases", { cache: "no-store" }),
      ]);
      const [salesJson, purJson] = await Promise.all([salesRes.json().catch(() => null), purRes.json().catch(() => null)]);
      if (!salesRes.ok) {
        throw new Error(
          (salesJson as { message?: string })?.message || "No se pudieron cargar las ventas del día",
        );
      }
      const s = Array.isArray(salesJson) ? (salesJson as SaleRow[]) : [];
      setSales(s);
      const allPur = purRes.ok && Array.isArray(purJson) ? (purJson as PurchaseRow[]) : [];
      setPurchasesDay(allPur.filter((p) => purchaseOnDate(p, dateYmd)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
      setSales([]);
      setPurchasesDay([]);
    } finally {
      setLoading(false);
    }
  }, [dateYmd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = useMemo(() => {
    const n = sales.length;
    const totalVentas = sales.reduce((a, s) => a + safeNumber(s.total), 0);
    const totalPropinas = sales.reduce((a, s) => a + safeNumber(s.service_total), 0);
    const totalInc = sales.reduce((a, s) => a + safeNumber(s.tax_total), 0);
    const totalCortesias = sales.reduce((a, s) => a + safeNumber(s.courtesy_total), 0);
    const egresosCompras = purchasesDay.reduce((a, p) => a + safeNumber(p.total_cost), 0);
    let totalTarjetas = 0;
    let totalTransferencias = 0;
    for (const s of sales) {
      const code = (s.payment_method ?? "").toLowerCase();
      const t = safeNumber(s.total);
      if (TARJETA_CODES.has(code)) {
        totalTarjetas += t;
      } else if (code === "transferencia") {
        totalTransferencias += t;
      }
    }
    return {
      n,
      totalVentas,
      totalPropinas,
      totalInc,
      totalCortesias,
      egresosCompras,
      totalTarjetas,
      totalTransferencias,
    };
  }, [sales, purchasesDay]);

  const opening = safeNumber(draft.opening);
  const cashIn = safeNumber(draft.cashIn);
  const counted = safeNumber(draft.counted);
  const esperadoEfectivo = opening + cashIn;
  const diferencia = counted - esperadoEfectivo;

  function updateDraft(partial: Partial<Draft>) {
    setDraft((prev) => {
      const next = { ...prev, ...partial };
      saveDraft(dateYmd, next);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-dark dark:text-white">Cierre de caja</h2>
          <p className="mt-1 text-sm text-body">
            Referencia con ventas y compras del día (Colombia). Los totales por tarjeta y transferencia usan
            el medio de pago guardado al cerrar el pedido. El efectivo físico se arquea abajo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-col text-xs font-medium text-dark-6 dark:text-dark-6">
            Fecha
            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="mt-1 rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (dateInput === dateYmd) {
                void loadData();
              } else {
                setDateYmd(dateInput);
              }
            }}
            className="mt-5 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => {
              void loadData();
            }}
            className="mt-5 rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Actualizar
          </button>
          <Link
            href="/sales"
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            Ir a ventas
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-red">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-lg border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-xs font-medium uppercase text-body-color dark:text-dark-6">Ventas (día)</p>
          <p className="mt-1 text-2xl font-semibold text-dark dark:text-white">{formatMoney(metrics.totalVentas)}</p>
          <p className="text-xs text-body-color dark:text-dark-6">{metrics.n} transacción(es) registrada(s)</p>
        </div>
        <div className="rounded-lg border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-xs font-medium uppercase text-body-color dark:text-dark-6">Propinas / servicio</p>
          <p className="mt-1 text-2xl font-semibold text-dark dark:text-white">{formatMoney(metrics.totalPropinas)}</p>
        </div>
        <div className="rounded-lg border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-xs font-medium uppercase text-body-color dark:text-dark-6">INC</p>
          <p className="mt-1 text-2xl font-semibold text-dark dark:text-white">{formatMoney(metrics.totalInc)}</p>
        </div>
        <div className="rounded-lg border border-stroke border-l-4 border-l-sky-500 bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-xs font-medium uppercase text-body-color dark:text-dark-6">Tarjetas (día)</p>
          <p className="mt-1 text-2xl font-semibold text-dark dark:text-white">{formatMoney(metrics.totalTarjetas)}</p>
        </div>
        <div className="rounded-lg border border-stroke border-l-4 border-l-violet-500 bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-xs font-medium uppercase text-body-color dark:text-dark-6">Transferencias (día)</p>
          <p className="mt-1 text-2xl font-semibold text-dark dark:text-white">
            {formatMoney(metrics.totalTransferencias)}
          </p>
        </div>
        <div className="rounded-lg border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-xs font-medium uppercase text-body-color dark:text-dark-6">Cortesías (monto)</p>
          <p className="mt-1 text-2xl font-semibold text-dark dark:text-white">{formatMoney(metrics.totalCortesias)}</p>
        </div>
        <div className="rounded-lg border border-stroke border-l-4 border-l-secondary bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-xs font-medium uppercase text-body-color dark:text-dark-6">Compras / egresos (día)</p>
          <p className="mt-1 text-2xl font-semibold text-dark dark:text-white">{formatMoney(metrics.egresosCompras)}</p>
          <p className="text-xs text-body-color dark:text-dark-6">
            {purchasesDay.length} registro(s) de compra
          </p>
        </div>
        <div className="rounded-lg border border-stroke bg-primary/5 p-4 dark:border-dark-3">
          <p className="text-xs font-medium uppercase text-primary">Ingresos − egresos (día, referencia)</p>
          <p className="mt-1 text-2xl font-semibold text-dark dark:text-white">
            {formatMoney(metrics.totalVentas - metrics.egresosCompras)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="text-lg font-semibold text-dark dark:text-white">Arqueo de efectivo (manual)</h3>
        <p className="mb-4 text-sm text-body">
          Complete solo lo que aplica. Los importes se guardan en este navegador para la fecha elegida.
        </p>
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <label className="text-sm text-dark dark:text-white">
            Fondo de apertura
            <input
              value={draft.opening}
              onChange={(e) => updateDraft({ opening: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </label>
          <label className="text-sm text-dark dark:text-white">
            Ingresos en efectivo (estimado)
            <input
              value={draft.cashIn}
              onChange={(e) => updateDraft({ cashIn: e.target.value })}
              inputMode="decimal"
              placeholder="Opcional: solo efectivo"
              className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </label>
          <label className="text-sm text-dark dark:text-white sm:col-span-2">
            Efectivo contado al cierre
            <input
              value={draft.counted}
              onChange={(e) => updateDraft({ counted: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              className="mt-1 w-full rounded-md border border-stroke bg-white px-3 py-2 text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </label>
        </div>
        <div className="mt-4 grid max-w-xl gap-2 rounded-md bg-gray-1 p-4 text-sm dark:bg-white/5">
          <p>
            <span className="text-body-color dark:text-dark-6">Efectivo esperado: </span>
            <span className="font-semibold text-dark dark:text-white">{formatMoney(esperadoEfectivo)}</span>
            <span className="text-body-color dark:text-dark-6"> (apertura + efectivo estimado)</span>
          </p>
          <p>
            <span className="text-body-color dark:text-dark-6">Diferencia (contado − esperado): </span>
            <span
              className={
                "font-semibold " +
                (diferencia > 0 ? "text-green-600" : diferencia < 0 ? "text-red" : "text-dark dark:text-white")
              }
            >
              {formatMoney(diferencia)}
            </span>
          </p>
        </div>
        <label className="mt-4 block text-sm text-dark dark:text-white">
          Notas del cierre
          <textarea
            value={draft.note}
            onChange={(e) => updateDraft({ note: e.target.value })}
            rows={3}
            className="mt-1 w-full max-w-2xl rounded-md border border-stroke bg-white px-3 py-2 text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            placeholder="Observaciones, turno, responsable..."
          />
        </label>
      </div>

      <div className="rounded-lg border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">Detalle de ventas del día</h3>
        {loading ? (
          <p className="text-sm text-body">Cargando...</p>
        ) : sales.length === 0 ? (
          <p className="text-sm text-body">No hay ventas registradas para esta fecha.</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Medio de pago</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">#{s.id}</TableCell>
                    <TableCell>
                      {dayjs(s.created_at).tz(COLOMBIA_TZ).format("DD/MM/YYYY HH:mm")}
                    </TableCell>
                    <TableCell>{paymentLabel(s.payment_method)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(s.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
