import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PurchasesReportList from "@/components/Inventory/purchases-report-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Informe de compras",
};

export default function InventoryPurchasesPage() {
  return (
    <>
      <Breadcrumb pageName="Informe de compras" />
      <PurchasesReportList />
    </>
  );
}
