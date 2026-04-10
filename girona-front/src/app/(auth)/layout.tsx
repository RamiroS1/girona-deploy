import type { PropsWithChildren } from "react";
import Image from "next/image";
import AuthTabs from "@/components/Auth/AuthTabs";

export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <Image
        src="/girona-images/Snapshot_202512356_091285.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/60" />

      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl dark:bg-black/20">
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-8 flex items-center justify-center">
            <Image
              src="/images/logo/LogoGP.png"
              alt="Logo"
              width={1000}
              height={1000}
              priority
              className="h-24 w-auto object-contain sm:h-28"
            />
          </div>

          <AuthTabs />
          {children}
        </div>
      </div>
    </main>
  );
}
