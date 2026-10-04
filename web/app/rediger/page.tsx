import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import {
  LESETYPER,
  STATUS_ETIKETT,
  TYPE_ETIKETT,
} from "@/lib/oppgaver/innhold";
import { hentRedaktorListe } from "@/lib/oppgaver/redaktor";
import { redaktorAvvist } from "./tilgang";

export default async function RedigerPage() {
  const avvist = await redaktorAvvist();
  if (avvist) {
    return avvist;
  }

  const liste = await hentRedaktorListe();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Rediger oppgaver</h1>
      <p>Lag en ny oppgave, eller endre en som finnes.</p>
      <ul className="flex flex-col gap-2">
        {LESETYPER.map((type) => (
          <li key={type}>
            <Link className="underline" href={`/rediger/ny?type=${type}`}>
              Ny oppgave: {TYPE_ETIKETT[type]}
            </Link>
          </li>
        ))}
      </ul>
      {!liste.ok ? (
        <p role="alert">{liste.feil}</p>
      ) : liste.data.length === 0 ? (
        <p>Du har ingen oppgaver ennå.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {liste.data.map((rad) => (
            <li key={rad.id}>
              <Link className="underline" href={`/rediger/${rad.id}`}>
                {rad.navn.trim() || "Uten navn"}
              </Link>
              {` — ${TYPE_ETIKETT[rad.type]} — ${rad.niva} — ${STATUS_ETIKETT[rad.status]}`}
              {rad.tema ? ` — ${rad.tema}` : ""}
            </li>
          ))}
        </ul>
      )}
    </Ramme>
  );
}
