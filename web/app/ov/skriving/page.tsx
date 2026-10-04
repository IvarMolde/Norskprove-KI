import Link from "next/link";
import { hentAktivSkriveoktId } from "@/lib/okt/skriving";
import { harRettighet, hentOktGrense, oktGrenseTekst } from "@/lib/rettigheter";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";
import { Ramme } from "../lesing/ramme";
import { StartKnapp } from "./start-knapp";

export default async function SkrivingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på skriving</h1>
        <p>Du må logge inn først.</p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </Ramme>
    );
  }

  const rett = await harRettighet("skriftlig_ki_vurdering");
  if (!rett) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på skriving</h1>
        <p>{oktFeilTekst("mangler_rettighet")}</p>
      </Ramme>
    );
  }

  const aktiv = await hentAktivSkriveoktId();
  const grense = await hentOktGrense();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Øv på skriving</h1>
      <p>Skriv en kort melding. Du får en vurdering etterpå.</p>
      {aktiv ? (
        <Link className="underline" href={`/ov/skriving/${aktiv}`}>
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
