import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import {
  LESETYPER,
  TYPE_ETIKETT,
  erLesetype,
  tomtSkjema,
} from "@/lib/oppgaver/innhold";
import { OppgaveSkjema } from "../skjema";
import { redaktorAvvist } from "../tilgang";

export default async function NyOppgavePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const avvist = await redaktorAvvist();
  if (avvist) {
    return avvist;
  }

  const { type } = await searchParams;
  if (!type || !erLesetype(type)) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Ny oppgave</h1>
        <p>Velg en type.</p>
        <ul className="flex flex-col gap-2">
          {LESETYPER.map((kandidat) => (
            <li key={kandidat}>
              <Link className="underline" href={`/rediger/ny?type=${kandidat}`}>
                {TYPE_ETIKETT[kandidat]}
              </Link>
            </li>
          ))}
        </ul>
      </Ramme>
    );
  }

  return (
    <Ramme>
      <Link className="underline" href="/rediger">
        Til listen
      </Link>
      <h1 className="text-2xl font-semibold">
        Ny oppgave: {TYPE_ETIKETT[type]}
      </h1>
      <OppgaveSkjema innhold={tomtSkjema(type)} niva="A2" tema="" />
    </Ramme>
  );
}
