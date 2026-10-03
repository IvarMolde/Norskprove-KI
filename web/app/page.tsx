import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: planer, error } = await supabase
    .from("abonnement_plan")
    .select("*");

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Vi fikk ikke hentet planene. Prøv igjen.</p>
        <p>
          <Link href="/ov/lesing">Øv på lesing</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Abonnementsplaner</h1>
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
        <Link href="/logg-inn">Logg inn</Link>
      </p>
    </div>
  );
}
