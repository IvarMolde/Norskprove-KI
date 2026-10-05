import Link from "next/link";
import {
  hentAktivAdaptiv,
  hentSisteAdaptivNiva,
  type SisteAdaptivNiva,
} from "@/lib/adaptiv";
import { oktFeilTekst } from "@/lib/okt/feil";
import { harRettighet, hentOktGrense, oktGrenseTekst } from "@/lib/rettigheter";
import { createClient } from "@/lib/supabase/server";
import { Ramme } from "../../ov/lesing/ramme";
import { GjenopptaKnapp } from "./pause-knapp";
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

  const [lesing, lytting, lesingNiva, lyttingNiva, grense, kanPause] = await Promise.all([
    hentAktivAdaptiv("lesing"),
    hentAktivAdaptiv("lytting"),
    hentSisteAdaptivNiva("lesing"),
    hentSisteAdaptivNiva("lytting"),
    hentOktGrense(),
    harRettighet("pause_gjenoppta"),
  ]);
  const stengt = Boolean(grense && !grense.kanStarte);

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Adaptiv prøve</h1>
      <p>Velg lesing eller lytting. Du får en nivågruppe etterpå.</p>
      <p>Dette er øving. Det er ikke et offisielt resultat.</p>
      {stengt && !lesing && !lytting ? <p>{oktGrenseTekst()}</p> : null}
      <section aria-label="Lesing" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Lesing</h2>
        <AdaptivValg
          aktiv={lesing}
          ferdighet="lesing"
          fortsett="Fortsett lesing"
          kanPause={kanPause}
          navn="lesing"
          siste={lesingNiva}
          stengt={stengt}
        />
      </section>
      <section aria-label="Lytting" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Lytting</h2>
        <AdaptivValg
          aktiv={lytting}
          ferdighet="lytting"
          fortsett="Fortsett lytting"
          kanPause={kanPause}
          navn="lytting"
          siste={lyttingNiva}
          stengt={stengt}
        />
      </section>
    </Ramme>
  );
}

function AdaptivValg({
  aktiv,
  ferdighet,
  fortsett,
  kanPause,
  navn,
  siste,
  stengt,
}: {
  aktiv: { id: string; status: "pagaende" | "avbrutt_lagret" } | null;
  ferdighet: "lesing" | "lytting";
  fortsett: string;
  kanPause: boolean;
  navn: "lesing" | "lytting";
  siste: SisteAdaptivNiva | null;
  stengt: boolean;
}) {
  let valg = null;

  if (aktiv?.status === "pagaende") {
    valg = (
      <Link className="underline" href={`/prove/adaptiv/${aktiv.id}`}>
        {fortsett}
      </Link>
    );
  } else if (aktiv?.status === "avbrutt_lagret") {
    valg = (
      <>
        <p>Økten er pauset.</p>
        <p>Oppgavene er de samme når du fortsetter.</p>
        {kanPause ? <GjenopptaKnapp oktId={aktiv.id} /> : null}
      </>
    );
  } else if (!stengt) {
    valg = <StartKnapp ferdighet={ferdighet} />;
  }

  return (
    <>
      {valg}
      {siste ? (
        <>
          <p>
            Nivågruppen din i {navn} er {siste.niva_gruppe}.
          </p>
          <Link className="underline" href={`/prove/adaptiv/${siste.id}`}>
            Se nivågruppen
          </Link>
        </>
      ) : null}
    </>
  );
}
