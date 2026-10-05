import Link from "next/link";
import { hentAktivLytteoktId, hentPausetLytteoktId } from "@/lib/okt/lytting";
import { harRettighet, hentOktGrense, oktGrenseTekst } from "@/lib/rettigheter";
import { createClient } from "@/lib/supabase/server";
import { Ramme } from "../lesing/ramme";
import { GjenopptaKnapp } from "./pause-knapp";
import { StartKnapp } from "./start-knapp";

export default async function LyttingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på lytting</h1>
        <p>Du må logge inn først.</p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </Ramme>
    );
  }

  const aktiv = await hentAktivLytteoktId();
  const pauset = aktiv ? null : await hentPausetLytteoktId();
  const kanPause = await harRettighet("pause_gjenoppta");
  const grense = await hentOktGrense();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Øv på lytting</h1>
      <p>Lytt til lydfilen. Les teksten. Svar ja eller nei.</p>
      {aktiv ? (
        <Link className="underline" href={`/ov/lytting/${aktiv}`}>
          Fortsett økten
        </Link>
      ) : pauset ? (
        <>
          <p>Økten er pauset.</p>
          <p>Oppgavene er de samme når du fortsetter.</p>
          {kanPause ? <GjenopptaKnapp oktId={pauset} /> : null}
        </>
      ) : grense && !grense.kanStarte ? (
        <p>{oktGrenseTekst()}</p>
      ) : (
        <StartKnapp />
      )}
    </Ramme>
  );
}
