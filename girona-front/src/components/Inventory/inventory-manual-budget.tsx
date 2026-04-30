"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "girona.inventory.manualBudgetCOP";

function normalizeMoneyInput(value: string) {
  return value.replace(/\D/g, "");
}

function formatCopInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const asNumber = Number(digits);
  if (!Number.isFinite(asNumber)) return "";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(asNumber);
}

/**
 * Presupuesto manual de referencia para inventario (solo este navegador).
 */
export default function InventoryManualBudget() {
  const [rawDigits, setRawDigits] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && /^\d+$/.test(saved)) {
        setRawDigits(saved);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (rawDigits) {
        window.localStorage.setItem(STORAGE_KEY, rawDigits);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [rawDigits, hydrated]);

  return (
    <div className="mb-4 rounded-md border border-stroke bg-gray-1/80 px-4 py-3 dark:border-dark-3 dark:bg-dark-2/60">
      <label
        htmlFor="inventory-manual-budget"
        className="mb-1 block text-sm font-medium text-dark dark:text-white"
      >
        ¿Cuánto es el presupuesto actual?
      </label>
      <p className="mb-2 text-xs text-body-color dark:text-dark-6">
        Valor manual de referencia (se guarda solo en este navegador).
      </p>
      <input
        id="inventory-manual-budget"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Ej: $ 5.000.000"
        value={formatCopInput(rawDigits)}
        onChange={(e) => setRawDigits(normalizeMoneyInput(e.target.value))}
        className="w-full max-w-xs rounded-md border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
      />
    </div>
  );
}
