import Link from "next/link";
import { erRedaktor } from "@/lib/rolle";
import { createClient } from "@/lib/supabase/server";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ slettet?: string }>;
}) {
  const params = await searchParams;
  const slettet = params.slettet === "1";
  const supabase = await createClient();
  const redaktor = await erRedaktor();
  const { data: planer, error } = await supabase
    .from("abonnement_plan")
    .select("*");

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Vi fikk ikke hentet planene. Prøv igjen.</p>
        {slettet ? <p>Kontoen er slettet.</p> : null}
        <p>
          <Link href="/ov/lesing">Øv på lesing</Link>
        </p>
        <p>
          <Link href="/ov/lytting">Øv på lytting</Link>
        </p>
        <p>
          <Link href="/ov/skriving">Øv på skriving</Link>
        </p>
        <p>
          <Link href="/betaling">Betaling</Link>
        </p>
        <p>
          <Link href="/personvern">Personvern</Link>
        </p>
        <p>
          <Link href="/databehandlere">Databehandleravtaler</Link>
        </p>
        <p>
          <Link href="/prove">Info om prøvene</Link>
        </p>
        <p>
          <Link href="/konto">Konto</Link>
        </p>
        <p>
          <Link href="/mine-data">Mine data</Link>
        </p>
        {redaktor ? (
          <p>
            <Link href="/rediger">Rediger oppgaver</Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Abonnementsplaner</h1>
      {slettet ? <p>Kontoen er slettet.</p> : null}
      <ul>
        {planer?.map((plan) => (
          <li key={plan.id}>
            {plan.navn} – {plan.pris_kr} kr – {plan.okter_grense} økter/
            {plan.okter_periode}
          </li>
        ))}
      </ul>
      <p>
        <Link href="/ov/lesing">Øv på lesing</Link>
      </p>
      <p>
        <Link href="/ov/lytting">Øv på lytting</Link>
      </p>
      <p>
        <Link href="/ov/skriving">Øv på skriving</Link>
      </p>
      <p>
        <Link href="/betaling">Betaling</Link>
      </p>
      <p>
        <Link href="/logg-inn">Logg inn</Link>
      </p>
      <p>
        <Link href="/personvern">Personvern</Link>
      </p>
      <p>
        <Link href="/databehandlere">Databehandleravtaler</Link>
      </p>
      <p>
        <Link href="/prove">Info om prøvene</Link>
      </p>
      <p>
        <Link href="/konto">Konto</Link>
      </p>
      <p>
        <Link href="/mine-data">Mine data</Link>
      </p>
      {redaktor ? (
        <p>
          <Link href="/rediger">Rediger oppgaver</Link>
        </p>
      ) : null}
    </div>
  );
}
