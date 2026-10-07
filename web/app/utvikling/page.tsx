import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import {
  lesMuntligUtvikling,
  lesSkriftligUtvikling,
  type UtviklingKriterium,
} from "@/lib/utvikling/les";
import { createClient } from "@/lib/supabase/server";

export default async function Utvikling() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Utviklingen din</h1>
        <p>Du må logge inn først.</p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </Ramme>
    );
  }

  try {
    const [skriftlig, muntlig] = await Promise.all([
      supabase
        .from("skriftlig_vurdering")
        .select("id, samlet_niva, kriterier, vurdert_dato")
        .order("vurdert_dato", { ascending: true }),
      supabase
        .from("muntlig_vurdering")
        .select("id, samlet_niva, formidling, sprakligekriterier, vurdert_dato")
        .order("vurdert_dato", { ascending: true }),
    ]);

    const skriving = lesSkriftligUtvikling(skriftlig.data);
    const tale = lesMuntligUtvikling(muntlig.data);

    if (skriftlig.error || muntlig.error || !skriving || !tale) {
      console.error(
        "utvikling",
        skriftlig.error?.code ?? muntlig.error?.code ?? "ugyldig",
      );
      return (
        <Ramme>
          <h1 className="text-2xl font-semibold">Utviklingen din</h1>
          <p role="alert">Vi fikk ikke hentet utviklingen. Prøv igjen.</p>
        </Ramme>
      );
    }

    const harSkriving = skriving.some((linje) => linje.punkter.length > 0);
    const harMuntlig = tale.some((linje) => linje.punkter.length > 0);

    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Utviklingen din</h1>
        <p>Her ser du nivået ditt over tid. Eldst står først.</p>
        {!harSkriving && !harMuntlig ? <p>Du har ingen vurderinger ennå.</p> : null}
        <UtviklingDel har={harSkriving} navn="Skriving" linjer={skriving} />
        <UtviklingDel har={harMuntlig} navn="Muntlig" linjer={tale} />
        <p>
          <Link className="underline" href="/mine-data">
            Mine data
          </Link>
        </p>
      </Ramme>
    );
  } catch (error) {
    console.error("utvikling", error);
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Utviklingen din</h1>
        <p role="alert">Vi fikk ikke hentet utviklingen. Prøv igjen.</p>
      </Ramme>
    );
  }
}

function UtviklingDel({
  navn,
  har,
  linjer,
}: {
  navn: string;
  har: boolean;
  linjer: UtviklingKriterium[];
}) {
  return (
    <section aria-label={navn} className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{navn}</h2>
      {har ? (
        linjer.map((linje) => (
          <section key={`${navn}:${linje.navn}`}>
            <h3 className="text-lg font-semibold">{linje.navn}</h3>
            <ol className="list-decimal pl-6">
              {linje.punkter.map((punkt, index) => (
                <li key={`${linje.navn}:${index}`}>
                  {punkt.dato}: {punkt.niva}
                </li>
              ))}
            </ol>
          </section>
        ))
      ) : (
        <p>Du har ingen vurderinger her ennå.</p>
      )}
    </section>
  );
}
