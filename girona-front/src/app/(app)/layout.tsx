import { Header } from "@/components/Layouts/header";
import { Sidebar } from "@/components/Layouts/sidebar";
import type { PropsWithChildren } from "react";

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen min-h-[100dvh]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col bg-gray-2 dark:bg-[#020d1a]">
        <Header />

        <main className="mx-auto w-full min-w-0 max-w-screen-2xl overflow-x-clip p-3 sm:p-4 md:p-6 2xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
