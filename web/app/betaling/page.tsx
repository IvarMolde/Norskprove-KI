import Link from "next/link";
import { z } from "zod";
import { lokalBekreftelseTillatt } from "@/lib/betaling/lokal";
import { harRettighet } from "@/lib/rettigheter";
import { createClient } from "@/lib/supabase/server";
import { Ramme } from "../ov/lesing/ramme";
import { KjopKnapp } from "./kjop-knapp";

const planSchema = z.object({
  id: z.enum(["plan_499", "plan_699", "plan_899"]),
  navn: z.string().min(1),
  pris_kr: z.number().int().positive(),
});

export default async function BetalingPage({
  searchParams,
}: {
  searchParams: Promise<{ kjopt?: string }>;
}) {
  const { kjopt } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Betaling</h1>
        <p>Du må logge inn først.</p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </Ramme>
    );
  }

  const { data, error } = await supabase
    .from("abonnement_plan")
    .select("id, navn, pris_kr")
    .gt("pris_kr", 0)
    .order("pris_kr");

  if (error) {
    console.error("betaling planer", error.code);
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Betaling</h1>
        <p role="alert">Vi fikk ikke hentet planene. Prøv igjen.</p>
      </Ramme>
    );
  }

  const planer = z.array(planSchema).safeParse(data);
  if (!planer.success) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Betaling</h1>
        <p role="alert">Vi fikk ikke hentet planene. Prøv igjen.</p>
      </Ramme>
    );
  }

  const [pause, skriftlig, muntlig, adaptiv] = await Promise.all([
    harRettighet("pause_gjenoppta"),
    harRettighet("skriftlig_ki_vurdering"),
    harRettighet("muntlig_ki_vurdering"),
    harRettighet("adaptiv_prove"),
  ]);
  const lokal = lokalBekreftelseTillatt();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Betaling</h1>
      <p>Velg Basis, Pluss eller Komplett.</p>
      {lokal ? <p>Ingen penger trekkes i denne testen.</p> : null}
      {kjopt === "1" ? <p>Planen er endret.</p> : null}
      {pause ? <p>Du kan pause en økt.</p> : null}
      {skriftlig ? <p>Du kan få vurdering av tekst.</p> : null}
      {muntlig ? <p>Du kan øve på muntlig.</p> : null}
      {adaptiv ? <p>Du kan ta en adaptiv prøve.</p> : null}
      <ul className="flex flex-col gap-6">
        {planer.data.map((plan) => (
          <li key={plan.id}>
            <KjopKnapp navn={plan.navn} planId={plan.id} />
          </li>
        ))}
      </ul>
    </Ramme>
  );
}