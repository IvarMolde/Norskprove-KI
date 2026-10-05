import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erLarer } from "@/lib/rolle";
import { createClient } from "@/lib/supabase/server";
import { OppgaveSkjema } from "../skjema";

export default async function NyOppgave() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Ny oppgave</h1>
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
        <h1 className="text-2xl font-semibold">Ny oppgave</h1>
        <p>{oktFeilTekst("kan_ikke_lage_oppgave")}</p>
      </Ramme>
    );
  }

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Ny oppgave</h1>
      <p>Velg fortelle, eller beskriv et bilde.</p>
      <OppgaveSkjema oppgave={null} />
      <p>
        <Link className="underline" href="/larer/oppgave">
          Tilbake
        </Link>
      </p>
    </Ramme>
  );
}
