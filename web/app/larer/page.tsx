import Link from "next/link";
import { datoTekst, hentInnleveringer } from "@/lib/larer";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erLarer } from "@/lib/rolle";
import { createClient } from "@/lib/supabase/server";
import { Ramme } from "../ov/lesing/ramme";

export default async function LarerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Muntlige innleveringer</h1>
        <p>Du må logge inn først.</p>
        <Link className="underline" href="/logg-inn">
          Logg inn
        </Link>
      </Ramme>
    );
  }

  if (!(await erLarer())) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Muntlige innleveringer</h1>
        <p>{oktFeilTekst("ikke_larer")}</p>
      </Ramme>
    );
  }

  const liste = await hentInnleveringer();
  if (!liste.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Muntlige innleveringer</h1>
        <p role="alert">{liste.feil}</p>
      </Ramme>
    );
  }

  const nye = liste.data.filter((rad) => rad.ny).length;
  const uten = liste.data.filter((rad) => !rad.har_kommentar).length;

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Muntlige innleveringer</h1>
      {liste.data.length === 0 ? (
        <p>Ingen muntlige innleveringer ennå.</p>
      ) : (
        <>
          <p>
            {nye === 0
              ? "Ingen nye innleveringer."
              : nye === 1
                ? "1 ny innlevering."
                : `${nye} nye innleveringer.`}
          </p>
          <p>
            {uten === 0
              ? "Alle har en kommentar."
              : uten === 1
                ? "1 mangler kommentar."
                : `${uten} mangler kommentar.`}
          </p>
        </>
      )}
      <ul className="flex flex-col gap-4">
        {liste.data.map((rad) => (
          <li key={rad.id}>
            {rad.ny ? <strong>Ny. </strong> : null}
            {rad.har_kommentar ? null : <strong>Mangler kommentar. </strong>}
            {rad.epost}. {rad.tittel}. {datoTekst(rad.innsendt)}.{" "}
            <Link className="underline" href={`/larer/${rad.id}`}>
              Hør
            </Link>
          </li>
        ))}
      </ul>
    </Ramme>
  );
}
