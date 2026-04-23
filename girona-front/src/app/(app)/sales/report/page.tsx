import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import SalesReportList from "@/components/Sales/sales-report-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Informe de ventas",
};

export default function SalesReportPage() {
  return (
    <>
      <Breadcrumb pageName="Informe de ventas" />
      <SalesReportList />
    </>
  );
}
