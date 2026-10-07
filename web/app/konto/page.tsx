import Link from "next/link";
import { Ramme } from "@/app/ov/lesing/ramme";
import { createClient } from "@/lib/supabase/server";
import { SlettSkjema } from "./slett-skjema";

export default async function KontoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Konto</h1>
      {user ? (
        <>
          <p>
            Når du sletter kontoen, slettes svar, økter, vurdering og
            bestillinger. Oppgaver i banken blir liggende.
          </p>
          <p>Dette kan ikke angres.</p>
          <SlettSkjema />
        </>
      ) : (
        <>
          <p>Du må logge inn først.</p>
          <Link className="underline" href="/logg-inn">
            Logg inn
          </Link>
        </>
      )}
    </Ramme>
  );
}
