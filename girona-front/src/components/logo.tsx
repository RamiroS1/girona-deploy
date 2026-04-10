import Image from "next/image";

export function Logo() {
  return (
    <div className="relative mx-auto h-32 w-32">
      <Image
        src="/images/logo/LogoGP.png"
        fill
        className="object-contain dark:hidden"
        alt="NextAdmin logo"
        role="presentation"
        quality={100}
      />

      <Image
        src="/images/logo/LogoGP.png"
        fill
        className="hidden object-contain dark:block"
        alt="NextAdmin logo"
        role="presentation"
        quality={100}
      />
    </div>
  );
}
