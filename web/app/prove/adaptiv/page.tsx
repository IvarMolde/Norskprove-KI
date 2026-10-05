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

  const [lesing, lytting, grense] = await Promise.all([
    hentAktivAdaptivId("lesing"),
    hentAktivAdaptivId("lytting"),
    hentOktGrense(),
  ]);
  const stengt = Boolean(grense && !grense.kanStarte);

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Adaptiv prøve</h1>
      <p>Velg lesing eller lytting. Du får en nivågruppe etterpå.</p>
      <p>Dette er øving. Det er ikke et offisielt resultat.</p>
      {stengt && !lesing && !lytting ? <p>{oktGrenseTekst()}</p> : null}
      <h2 className="text-xl font-semibold">Lesing</h2>
      {lesing ? (
        <Link className="underline" href={`/prove/adaptiv/${lesing}`}>
          Fortsett lesing
        </Link>
      ) : stengt ? null : (
        <StartKnapp ferdighet="lesing" />
      )}
      <h2 className="text-xl font-semibold">Lytting</h2>
      {lytting ? (
        <Link className="underline" href={`/prove/adaptiv/${lytting}`}>
          Fortsett lytting
        </Link>
      ) : stengt ? null : (
        <StartKnapp ferdighet="lytting" />
      )}
    </Ramme>
  );
}
