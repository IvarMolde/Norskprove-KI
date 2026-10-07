import Link from "next/link";
import { hentAktivLeseoktId, hentPausetLeseoktId } from "@/lib/okt/lesing";
import { hentOktGrense, oktGrenseTekst } from "@/lib/rettigheter";
import { erRedaktor } from "@/lib/rolle";
import { createClient } from "@/lib/supabase/server";
import { GjenopptaKnapp } from "./pause-knapp";
import { Ramme } from "./ramme";
import { StartKnapp } from "./start-knapp";

export default async function LesingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på lesing</h1>
        <p>Du må logge inn først.</p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </Ramme>
    );
  }

  const aktiv = await hentAktivLeseoktId();
  const pauset = aktiv ? null : await hentPausetLeseoktId();
  const grense = await hentOktGrense();
  const redaktor = await erRedaktor();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Øv på lesing</h1>
      <p>Du får flere typer oppgaver. Les, og svar på hver oppgave.</p>
      {aktiv ? (
        <Link className="underline" href={`/ov/lesing/${aktiv}`}>
          Fortsett økten
        </Link>
      ) : pauset ? (
        <GjenopptaKnapp oktId={pauset} />
      ) : grense && !grense.kanStarte ? (
        <p>{oktGrenseTekst()}</p>
      ) : (
        <StartKnapp />
      )}
      {redaktor ? (
        <Link className="underline" href="/rediger">
          Rediger oppgaver
        </Link>
      ) : null}
    </Ramme>
  );
}
