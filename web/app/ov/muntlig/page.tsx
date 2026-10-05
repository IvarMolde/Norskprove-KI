import Link from "next/link";
import {
  hentAktivMuntligOktId,
  hentPausetMuntligOktId,
  hentSisteFullfortMuntligOktId,
} from "@/lib/okt/muntlig";
import { harRettighet, hentOktGrense, oktGrenseTekst } from "@/lib/rettigheter";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";
import { Ramme } from "../lesing/ramme";
import { GjenopptaKnapp } from "./pause-knapp";
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
  const pauset = aktiv ? null : await hentPausetMuntligOktId();
  const kanPause = await harRettighet("pause_gjenoppta");
  const ferdig = await hentSisteFullfortMuntligOktId();
  const grense = await hentOktGrense();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Øv på muntlig</h1>
      <p>Du forteller først. Så beskriver du et bilde. Du får en vurdering etterpå.</p>
      {aktiv ? (
        <Link className="underline" href={`/ov/muntlig/${aktiv}`}>
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
      {ferdig && ferdig !== aktiv ? (
        <Link className="underline" href={`/ov/muntlig/${ferdig}`}>
          Se vurderingen
        </Link>
      ) : null}
    </Ramme>
  );
}
