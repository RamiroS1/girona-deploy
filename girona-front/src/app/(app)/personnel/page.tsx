import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Personnel from "@/components/Personnel";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Personal",
};

export default function PersonnelPage() {
  return (
    <>
      <Breadcrumb pageName="Personal" />
      <Suspense fallback={<p className="text-sm text-body">Cargando personal...</p>}>
        <Personnel />
      </Suspense>
    </>
  );
}
