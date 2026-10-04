import Link from "next/link";
import { hentAktivLytteoktId } from "@/lib/okt/lytting";
import { hentOktGrense, oktGrenseTekst } from "@/lib/rettigheter";
import { createClient } from "@/lib/supabase/server";
import { Ramme } from "../lesing/ramme";
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
  const grense = await hentOktGrense();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Øv på lytting</h1>
      <p>Lytt til lydfilen. Les teksten. Svar ja eller nei.</p>
      {aktiv ? (
        <Link className="underline" href={`/ov/lytting/${aktiv}`}>
          Fortsett økten
        </Link>
      ) : grense && !grense.kanStarte ? (
        <p>{oktGrenseTekst()}</p>
      ) : (
        <StartKnapp />
      )}
    </Ramme>
  );
}
