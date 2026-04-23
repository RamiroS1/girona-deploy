import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import CashClosing from "@/components/CashClosing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cierre de caja",
};

export default function CashClosingPage() {
  return (
    <>
      <Breadcrumb pageName="Cierre de caja" />
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <CashClosing />
      </div>
    </>
  );
}
