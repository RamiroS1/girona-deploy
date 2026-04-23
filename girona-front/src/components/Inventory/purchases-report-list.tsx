"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const COLOMBIA_TZ = "America/Bogota";

type PurchaseItem = {
  id: number;
  product_id: number;
  product_name: string | null;
  quantity: string;
  unit_cost: string;
  line_total: string;
};

type Purchase = {
  id: number;
  supplier_id: number | null;
  purchased_at: string | null;
  received_at: string | null;
  total_cost: string;
  created_at: string;
  items: PurchaseItem[];
};

function formatCop(value: unknown) {
  const asNumber = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(asNumber)) return String(value ?? "");
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(asNumber);
}

function formatQty(value: unknown) {
  const asNumber = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(asNumber)) return String(value ?? "");
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(asNumber));
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const withOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const parsed = withOffset ? dayjs(value) : dayjs.tz(value, COLOMBIA_TZ);
  return parsed.isValid() ? parsed.tz(COLOMBIA_TZ) : null;
}

function purchaseRefDate(p: Purchase) {
  return parseDate(p.received_at ?? p.purchased_at ?? p.created_at);
}

function inDateRange(
  p: Purchase,
  rangeStart: Dayjs,
  rangeEnd: Dayjs,
) {
  const d = purchaseRefDate(p);
  if (!d) return false;
  return !d.isBefore(rangeStart, "day") && !d.isAfter(rangeEnd, "day");
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function PurchasesReportList() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeMode, setRangeMode] = useState<"month" | "day" | "custom">("month");
  const [selectedMonth, setSelectedMonth] = useState(() =>
    dayjs().tz(COLOMBIA_TZ).format("YYYY-MM"),
  );
  const [selectedDay, setSelectedDay] = useState(() =>
    dayjs().tz(COLOMBIA_TZ).format("YYYY-MM-DD"),
  );
  const [customStart, setCustomStart] = useState(() =>
    dayjs().tz(COLOMBIA_TZ).subtract(1, "month").format("YYYY-MM-DD"),
  );
  const [customEnd, setCustomEnd] = useState(() =>
    dayjs().tz(COLOMBIA_TZ).format("YYYY-MM-DD"),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/inventory/purchases", { cache: "no-store" });
        const payload = await safeJson(res);
        if (cancelled) return;
        setPurchases(Array.isArray(payload) ? (payload as Purchase[]) : []);
      } catch {
        if (!cancelled) setPurchases([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = dayjs().tz(COLOMBIA_TZ);
  const defaultEnd = now.startOf("day");

  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    if (rangeMode === "custom") {
      const startCandidate = dayjs.tz(customStart, COLOMBIA_TZ).startOf("day");
      const endCandidate = dayjs.tz(customEnd, COLOMBIA_TZ).startOf("day");
      const validStart = startCandidate.isValid() ? startCandidate : defaultEnd;
      const validEnd = endCandidate.isValid() ? endCandidate : defaultEnd;
      const start = validStart.isAfter(validEnd) ? validEnd : validStart;
      const end = validStart.isAfter(validEnd) ? validStart : validEnd;
      return {
        rangeStart: start,
        rangeEnd: end,
        rangeLabel: `Del ${start.format("DD/MM/YYYY")} al ${end.format("DD/MM/YYYY")}`,
      };
    }
    if (rangeMode === "day") {
      const dayCandidate = dayjs.tz(selectedDay, COLOMBIA_TZ).startOf("day");
      const start = dayCandidate.isValid() ? dayCandidate : defaultEnd;
      return {
        rangeStart: start,
        rangeEnd: start,
        rangeLabel: `Dia ${start.format("DD/MM/YYYY")}`,
      };
    }
    const monthStart = dayjs.tz(`${selectedMonth}-01`, COLOMBIA_TZ).startOf("month");
    const start = monthStart.isValid() ? monthStart : defaultEnd.startOf("month");
    const end = start.endOf("month").startOf("day");
    const label = new Intl.DateTimeFormat("es-CO", {
      month: "long",
      year: "numeric",
      timeZone: COLOMBIA_TZ,
    }).format(start.toDate());
    return { rangeStart: start, rangeEnd: end, rangeLabel: label };
  }, [rangeMode, selectedMonth, selectedDay, customStart, customEnd, defaultEnd]);

  const filteredPurchases = useMemo(
    () => purchases.filter((p) => inDateRange(p, rangeStart, rangeEnd)),
    [purchases, rangeStart, rangeEnd],
  );

  return (
    <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-dark dark:text-white">
            Compras registradas
          </h2>
          <p className="text-sm text-body-color dark:text-dark-6">
            {rangeLabel} · {filteredPurchases.length} registro
            {filteredPurchases.length === 1 ? "" : "s"}
            {purchases.length
              ? ` de ${purchases.length} en total`
              : ""}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={rangeMode}
              onChange={(e) =>
                setRangeMode(e.target.value as "month" | "day" | "custom")
              }
              className="h-9 rounded-md border border-stroke bg-white px-3 text-sm text-dark shadow-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            >
              <option value="month">Mes especifico</option>
              <option value="day">Dia especifico</option>
              <option value="custom">Rango personalizado</option>
            </select>
            {rangeMode === "custom" ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 rounded-md border border-stroke bg-white px-2 text-sm text-dark shadow-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                />
                <span className="text-sm text-body">a</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-9 rounded-md border border-stroke bg-white px-2 text-sm text-dark shadow-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                />
              </div>
            ) : rangeMode === "day" ? (
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="h-9 rounded-md border border-stroke bg-white px-2 text-sm text-dark shadow-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                title="Elegi un dia concreto"
              />
            ) : (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 rounded-md border border-stroke bg-white px-2 text-sm text-dark shadow-sm outline-none transition focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              />
            )}
          </div>
          <Link
            href="/inventory"
            className="rounded-md border border-stroke px-4 py-2 text-center text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          >
            Volver a inventario
          </Link>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto">
        {loading ? (
          <p className="px-4 py-6 text-sm text-body-color">Cargando informe…</p>
        ) : (
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-2 text-left dark:bg-dark-2">
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">ID</th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Proveedor
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">
                  Recibida
                </th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">Items</th>
                <th className="px-4 py-3 text-sm font-medium text-dark dark:text-white">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-sm text-body-color dark:text-dark-6"
                  >
                    No hay compras en este rango.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => (
                  <Fragment key={p.id}>
                    <tr className="border-b border-stroke dark:border-dark-3">
                      <td className="px-4 py-3 text-sm text-dark dark:text-white">{p.id}</td>
                      <td className="px-4 py-3 text-sm text-body-color dark:text-dark-6">
                        {p.supplier_id ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-body-color dark:text-dark-6">
                        {p.received_at
                          ? new Date(p.received_at).toLocaleString("es-CO")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-body-color dark:text-dark-6">
                        {p.items?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-body-color dark:text-dark-6">
                        {formatCop(p.total_cost)}
                      </td>
                    </tr>
                    <tr className="border-b border-stroke dark:border-dark-3">
                      <td colSpan={5} className="px-4 pb-4 pt-2">
                        <div className="rounded-md border border-stroke bg-white p-3 text-sm dark:border-dark-3 dark:bg-dark-2">
                          <div className="mb-2 text-xs font-semibold uppercase text-dark-6 dark:text-dark-6">
                            Items comprados
                          </div>
                          {p.items?.length ? (
                            <div className="max-w-full overflow-x-auto">
                              <table className="w-full table-auto text-sm">
                                <thead>
                                  <tr className="text-left text-xs uppercase text-dark-6 dark:text-dark-6">
                                    <th className="px-2 py-1">Producto</th>
                                    <th className="px-2 py-1">Cantidad</th>
                                    <th className="px-2 py-1">Costo unitario</th>
                                    <th className="px-2 py-1">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.items.map((item) => (
                                    <tr key={item.id}>
                                      <td className="px-2 py-1 text-dark dark:text-white">
                                        {item.product_name?.trim()
                                          ? item.product_name
                                          : `#${item.product_id}`}
                                      </td>
                                      <td className="px-2 py-1 text-body-color dark:text-dark-6">
                                        {formatQty(item.quantity)}
                                      </td>
                                      <td className="px-2 py-1 text-body-color dark:text-dark-6">
                                        {formatCop(item.unit_cost)}
                                      </td>
                                      <td className="px-2 py-1 text-body-color dark:text-dark-6">
                                        {formatCop(item.line_total)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-body-color dark:text-dark-6">
                              Sin items registrados.
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
