import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import {
  alderTekst,
  erNiva,
  ferdighetTekst,
  lesMineSvar,
  oktStatusTekst,
  type MineSvarRad,
} from "@/lib/personvern/mine-data";
import { slettGammelLyd } from "@/lib/personvern/slett-lyd";
import { createClient } from "@/lib/supabase/server";
import { EpostSkjema } from "./epost-skjema";
import { NivaSkjema } from "./niva-skjema";

export default async function MineData({
  searchParams,
}: {
  searchParams: Promise<{ lagret?: string; epost?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Mine data</h1>
        <p>Du må logge inn først.</p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </Ramme>
    );
  }

  await slettGammelLyd();

  try {
    const profil = await supabase
      .from("brukerprofil")
      .select("abonnement_plan_id, alder_bekreftet_metode, valgt_niva")
      .eq("id", user.id)
      .single();

    if (profil.error || !profil.data) {
      return (
        <Ramme>
          <h1 className="text-2xl font-semibold">Mine data</h1>
          <p role="alert">Vi fikk ikke hentet opplysningene. Prøv igjen.</p>
        </Ramme>
      );
    }

    const plan = await supabase
      .from("abonnement_plan")
      .select("navn")
      .eq("id", profil.data.abonnement_plan_id)
      .single();

    const [okter, svar, bestillinger, vurderinger, muntlige, liste, mineSvar] = await Promise.all([
      supabase.from("okt_tilstand").select("id", { count: "exact", head: true }),
      supabase.from("bruker_svar").select("id", { count: "exact", head: true }),
      supabase.from("betaling").select("id", { count: "exact", head: true }),
      supabase
        .from("skriftlig_vurdering")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("muntlig_vurdering")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("okt_tilstand")
        .select("id, ferdighet, status, startet")
        .order("startet", { ascending: false })
        .limit(10),
      supabase.rpc("hent_mine_svar"),
    ]);

    const svarRader = lesMineSvar(mineSvar.data);

    if (mineSvar.error || !svarRader) {
      console.error("hent_mine_svar", mineSvar.error?.code ?? "ugyldig");
    }

    if (
      okter.error ||
      svar.error ||
      bestillinger.error ||
      vurderinger.error ||
      muntlige.error ||
      liste.error ||
      mineSvar.error ||
      !svarRader
    ) {
      return (
        <Ramme>
          <h1 className="text-2xl font-semibold">Mine data</h1>
          <p role="alert">Vi fikk ikke hentet opplysningene. Prøv igjen.</p>
        </Ramme>
      );
    }

    const kandidat = profil.data.valgt_niva ?? "";
    const valgt = erNiva(kandidat) ? kandidat : null;

    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Mine data</h1>
        {params.lagret === "1" ? <p>Nivået er lagret.</p> : null}
        <p>E-post: {user.email}</p>
        {user.new_email ? (
          <p>
            Ny e-post venter på bekreftelse: {user.new_email}. Åpne e-posten
            til den gamle eller den nye adressen.
          </p>
        ) : null}
        {params.epost === "1" ? (
          <p>Vi har sendt en e-post. Åpne den for å bekrefte.</p>
        ) : null}
        {params.epost === "2" ? <p>E-posten er endret.</p> : null}
        <EpostSkjema />
        <p>Plan: {plan.data?.navn ?? "Ukjent"}</p>
        <p>Planen endres ikke her.</p>
        <p>{alderTekst(profil.data.alder_bekreftet_metode)}</p>
        <p>Alder kan ikke endres her.</p>
        <NivaSkjema valgt={valgt} />
        <h2 className="text-xl font-semibold">Det vi har lagret</h2>
        <ul className="list-disc pl-6">
          <li>Økter: {okter.count ?? 0}</li>
          <li>Svar: {svar.count ?? 0}</li>
          <li>Vurderinger: {(vurderinger.count ?? 0) + (muntlige.count ?? 0)}</li>
          <li>Bestillinger: {bestillinger.count ?? 0}</li>
        </ul>
        {liste.data && liste.data.length > 0 ? (
          <ul className="list-disc pl-6">
            {liste.data.map((okt) => (
              <li key={okt.id}>
                {ferdighetTekst(okt.ferdighet)} – {oktStatusTekst(okt.status)}
              </li>
            ))}
          </ul>
        ) : (
          <p>Du har ingen økter ennå.</p>
        )}
        <h2 className="text-xl font-semibold">Svarene dine</h2>
        {svarRader.length === 0 ? (
          <p>Du har ingen svar ennå.</p>
        ) : (
          svarRader.map((rad) => <SvarKort key={rad.id} rad={rad} />)
        )}
        <p>
          <Link className="underline" href="/konto">
            Slett konto
          </Link>
        </p>
        <p>
          <Link className="underline" href="/personvern">
            Personvern
          </Link>
        </p>
      </Ramme>
    );
  } catch {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Mine data</h1>
        <p role="alert">Vi fikk ikke hentet opplysningene. Prøv igjen.</p>
      </Ramme>
    );
  }
}

function SvarKort({ rad }: { rad: MineSvarRad }) {
  const sprak = [
    rad.flyt_tekst ? { navn: "Flyt", niva: rad.flyt_niva, tekst: rad.flyt_tekst } : null,
    rad.uttale_tekst
      ? { navn: "Uttale", niva: rad.uttale_niva, tekst: rad.uttale_tekst }
      : null,
    rad.ord_tekst ? { navn: "Ordforråd", niva: rad.ord_niva, tekst: rad.ord_tekst } : null,
    rad.grammatikk_tekst
      ? { navn: "Grammatikk", niva: rad.grammatikk_niva, tekst: rad.grammatikk_tekst }
      : null,
  ].filter((linje) => linje !== null);

  return (
    <article className="flex flex-col gap-2 border border-current p-4">
      <h3 className="text-lg font-semibold">
        {ferdighetTekst(rad.ferdighet)}. {rad.tittel}
      </h3>
      {rad.er_kladd ? <p>Kladd</p> : null}
      {rad.svar.map((linje, index) => (
        <p className="whitespace-pre-wrap" key={`${rad.id}:${index}`}>
          {linje}
        </p>
      ))}
      {rad.formidling_niva ? <p>Formidling: {rad.formidling_niva}</p> : null}
      {rad.formidling_tekst ? <p>{rad.formidling_tekst}</p> : null}
      {sprak.length > 0 ? (
        <>
          <h4 className="font-semibold">Språk</h4>
          {sprak.map((linje) => (
            <p key={linje.navn}>
              {linje.navn}: {linje.niva}. {linje.tekst}
            </p>
          ))}
        </>
      ) : null}
      {rad.niva ? <p>Nivå: {rad.niva}</p> : null}
      {rad.niva && rad.usikker ? <p>Vi er ikke sikre på vurderingen.</p> : null}
      {rad.niva && rad.usikker_lyd ? <p>Vi er ikke sikre på uttale og flyt.</p> : null}
      {rad.tilbakemelding ? <p>{rad.tilbakemelding}</p> : null}
      {rad.forbedring && rad.forbedring.length > 0 ? (
        <>
          <p>Dette kan du øve på</p>
          <ol className="list-decimal pl-6">
            {rad.forbedring.map((punkt, index) => (
              <li key={`${rad.id}:f:${index}`}>{punkt}</li>
            ))}
          </ol>
        </>
      ) : null}
      {rad.positivt ? <p>Bra: {rad.positivt}</p> : null}
      {rad.larer_tekst ? (
        <>
          <p>Læreren setter nivået til {rad.larer_niva}.</p>
          <p className="whitespace-pre-wrap">{rad.larer_tekst}</p>
        </>
      ) : null}
    </article>
  );
}
