import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Envuelve tablas anchas para scroll horizontal en móvil y tablet
 * (sin forzar ancho fijo: las celdas con min-w* definen el ancho mínimo).
 */
export function TableScroll({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "w-full max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      {children}
    </div>
  );
}
