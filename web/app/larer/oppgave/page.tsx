import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import { oktFeilTekst } from "@/lib/okt/feil";
import {
  hentLarerOppgaver,
  statusEtikett,
  typeEtikett,
} from "@/lib/larer/oppgaver";
import { erLarer } from "@/lib/rolle";
import { createClient } from "@/lib/supabase/server";

export default async function OppgaveListe({
  searchParams,
}: {
  searchParams: Promise<{ lagret?: string }>;
}) {
  const { lagret } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Muntlige oppgaver</h1>
        <p>Du må logge inn først.</p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </Ramme>
    );
  }

  if (!(await erLarer())) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Muntlige oppgaver</h1>
        <p>{oktFeilTekst("kan_ikke_lage_oppgave")}</p>
      </Ramme>
    );
  }

  const liste = await hentLarerOppgaver();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Muntlige oppgaver</h1>
      <p>Lag en oppgave. Legg inn bilde når eleven skal beskrive det.</p>
      {lagret === "1" ? <p>Oppgaven er lagret.</p> : null}
      <p>
        <Link className="underline" href="/larer/oppgave/ny">
          Ny oppgave
        </Link>
      </p>
      {!liste.ok ? (
        <p role="alert">{liste.feil}</p>
      ) : liste.data.length === 0 ? (
        <p>Ingen muntlige oppgaver ennå.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {liste.data.map((rad) => (
            <li key={rad.id}>
              <Link className="underline" href={`/larer/oppgave/${rad.id}`}>
                {rad.tittel}
              </Link>
              {` — ${typeEtikett(rad.oppgavetype)} — ${rad.nivagruppe} — ${statusEtikett(rad.status)}`}
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link className="underline" href="/larer">
          Tilbake
        </Link>
      </p>
    </Ramme>
  );
}
