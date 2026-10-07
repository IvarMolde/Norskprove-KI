import Link from "next/link";
import type { ReactNode } from "react";
import { Ramme } from "@/app/ov/lesing/ramme";
import { redaktorTilgang } from "@/lib/rolle";

export async function redaktorAvvist(): Promise<ReactNode | null> {
  const tilgang = await redaktorTilgang();
  if (tilgang === "redaktor") {
    return null;
  }

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Rediger oppgaver</h1>
      {tilgang === "utlogget" ? (
        <>
          <p>Du må logge inn først.</p>
          <Link className="underline" href="/logg-inn">
            Logg inn
          </Link>
        </>
      ) : (
        <p>Du kan ikke redigere oppgaver.</p>
      )}
    </Ramme>
  );
}
