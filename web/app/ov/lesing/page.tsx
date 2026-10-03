import Link from "next/link";
import { hentAktivLeseoktId } from "@/lib/okt/lesing";
import { hentOktGrense, oktGrenseTekst } from "@/lib/rettigheter";
import { createClient } from "@/lib/supabase/server";
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
  const grense = await hentOktGrense();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Øv på lesing</h1>
      <p>Les en kort tekst. Svar ja eller nei på påstandene.</p>
      {aktiv ? (
        <Link className="underline" href={`/ov/lesing/${aktiv}`}>
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
