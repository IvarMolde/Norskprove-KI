import Link from "next/link";
import { hentAktivMuntligOktId, hentSisteFullfortMuntligOktId } from "@/lib/okt/muntlig";
import { harRettighet, hentOktGrense, oktGrenseTekst } from "@/lib/rettigheter";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";
import { Ramme } from "../lesing/ramme";
import { StartKnapp } from "./start-knapp";

export default async function MuntligPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på muntlig</h1>
        <p>Du må logge inn først.</p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </Ramme>
    );
  }

  const rett = await harRettighet("muntlig_ki_vurdering");
  if (!rett) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på muntlig</h1>
        <p>{oktFeilTekst("mangler_muntlig")}</p>
      </Ramme>
    );
  }

  const aktiv = await hentAktivMuntligOktId();
  const ferdig = await hentSisteFullfortMuntligOktId();
  const grense = await hentOktGrense();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Øv på muntlig</h1>
      <p>Fortell om dagen din. Du får en vurdering etterpå.</p>
      {aktiv ? (
        <Link className="underline" href={`/ov/muntlig/${aktiv}`}>
          Fortsett økten
        </Link>
      ) : grense && !grense.kanStarte ? (
        <p>{oktGrenseTekst()}</p>
      ) : (
        <StartKnapp />
      )}
      {ferdig && ferdig !== aktiv ? (
        <Link className="underline" href={`/ov/muntlig/${ferdig}`}>
          Se vurderingen
        </Link>
      ) : null}
    </Ramme>
  );
}
