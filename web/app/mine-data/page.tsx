import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import {
  alderTekst,
  erNiva,
  ferdighetTekst,
  oktStatusTekst,
} from "@/lib/personvern/mine-data";
import { createClient } from "@/lib/supabase/server";
import { NivaSkjema } from "./niva-skjema";

export default async function MineData({
  searchParams,
}: {
  searchParams: Promise<{ lagret?: string }>;
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

    const [okter, svar, bestillinger, vurderinger, liste] = await Promise.all([
      supabase.from("okt_tilstand").select("id", { count: "exact", head: true }),
      supabase.from("bruker_svar").select("id", { count: "exact", head: true }),
      supabase.from("betaling").select("id", { count: "exact", head: true }),
      supabase
        .from("skriftlig_vurdering")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("okt_tilstand")
        .select("id, ferdighet, status, startet")
        .order("startet", { ascending: false })
        .limit(10),
    ]);

    if (okter.error || svar.error || bestillinger.error || vurderinger.error || liste.error) {
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
        <p>E-posten kan ikke endres her.</p>
        <p>Plan: {plan.data?.navn ?? "Ukjent"}</p>
        <p>Planen endres ikke her.</p>
        <p>{alderTekst(profil.data.alder_bekreftet_metode)}</p>
        <p>Alder kan ikke endres her.</p>
        <NivaSkjema valgt={valgt} />
        <h2 className="text-xl font-semibold">Det vi har lagret</h2>
        <ul className="list-disc pl-6">
          <li>Økter: {okter.count ?? 0}</li>
          <li>Svar: {svar.count ?? 0}</li>
          <li>Vurderinger: {vurderinger.count ?? 0}</li>
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
