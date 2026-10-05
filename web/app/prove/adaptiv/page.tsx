import Link from "next/link";
import { hentAktivAdaptivId } from "@/lib/adaptiv";
import { oktFeilTekst } from "@/lib/okt/feil";
import { harRettighet, hentOktGrense, oktGrenseTekst } from "@/lib/rettigheter";
import { createClient } from "@/lib/supabase/server";
import { Ramme } from "../../ov/lesing/ramme";
import { StartKnapp } from "./start-knapp";

export default async function AdaptivSide() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Adaptiv prøve</h1>
        <p>Du må logge inn først.</p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </Ramme>
    );
  }

  const rett = await harRettighet("adaptiv_prove");
  if (!rett) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Adaptiv prøve</h1>
        <p>{oktFeilTekst("mangler_adaptiv")}</p>
      </Ramme>
    );
  }

  const aktiv = await hentAktivAdaptivId();
  const grense = await hentOktGrense();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Adaptiv prøve</h1>
      <p>Dette er en leseprøve. Du får en nivågruppe etterpå.</p>
      <p>Dette er øving. Det er ikke et offisielt resultat.</p>
      {aktiv ? (
        <Link className="underline" href={`/prove/adaptiv/${aktiv}`}>
          Fortsett prøven
        </Link>
      ) : grense && !grense.kanStarte ? (
        <p>{oktGrenseTekst()}</p>
      ) : (
        <StartKnapp />
      )}
    </Ramme>
  );
}
