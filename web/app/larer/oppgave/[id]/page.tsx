import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import { hentLarerOppgave } from "@/lib/larer/oppgaver";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erLarer } from "@/lib/rolle";
import { createClient } from "@/lib/supabase/server";
import { OppgaveSkjema } from "../skjema";

export default async function EndreOppgave({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Endre oppgave</h1>
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
        <h1 className="text-2xl font-semibold">Endre oppgave</h1>
        <p>{oktFeilTekst("kan_ikke_lage_oppgave")}</p>
      </Ramme>
    );
  }

  const oppgave = await hentLarerOppgave(id);
  if (!oppgave.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Endre oppgave</h1>
        <p role="alert">{oppgave.feil}</p>
        <Link className="underline" href="/larer/oppgave">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Endre oppgave</h1>
      <OppgaveSkjema oppgave={oppgave.data} />
      <p>
        <Link className="underline" href="/larer/oppgave">
          Tilbake
        </Link>
      </p>
    </Ramme>
  );
}
