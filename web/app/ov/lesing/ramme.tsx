import Link from "next/link";
import type { ReactNode } from "react";

export function Ramme({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10 text-lg leading-relaxed">
      <Link className="text-base underline" href="/">
        Hjem
      </Link>
      {children}
    </main>
  );
}
