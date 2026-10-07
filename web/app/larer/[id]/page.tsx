import Link from "next/link";
import { datoTekst, hentInnlevering, markerHort } from "@/lib/larer";
import { Ramme } from "../../ov/lesing/ramme";
import { MuntligBilde } from "../../ov/muntlig/bilde";
import { KommentarSkjema } from "../kommentar-skjema";

export default async function InnleveringPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sendt?: string }>;
}) {
  const { id } = await params;
  const { sendt } = await searchParams;
  const resultat = await hentInnlevering(id);

  if (!resultat.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Innlevering</h1>
        <p role="alert">{resultat.feil}</p>
        <Link className="underline" href="/larer">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  if (resultat.data.ny) {
    await markerHort(resultat.data.id);
  }

  const rad = resultat.data;

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Muntlig økt</h1>
      {rad.ny ? <p><strong>Ny</strong></p> : null}
      <p>{rad.epost}</p>
      <p>{datoTekst(rad.innsendt)}</p>
      {rad.deler.length > 1 ? <p>Du hører begge opptakene.</p> : null}
      {sendt === "1" ? <p>Kommentaren er sendt.</p> : null}
      {rad.deler.map((del, index) => (
        <section className="flex flex-col gap-4" key={del.id}>
          <h2 className="text-xl font-semibold">
            Oppgave {index + 1}: {del.tittel}
          </h2>
          <p>{del.oppgavetekst}</p>
          {del.bilde ? (
            <MuntligBilde
              beskrivelse={del.bilde.beskrivelse}
              endelse={del.bilde.endelse}
              url={del.bilde.url}
            />
          ) : null}
          <audio aria-label={`Opptak for ${del.tittel}`} controls preload="none" src={`/larer/lyd/${del.id}`}>
            Nettleseren kan ikke spille av lyden.
          </audio>
          <h3 className="text-lg font-semibold">Teksten eleven sa</h3>
          <p className="whitespace-pre-wrap">{del.svar}</p>
          <KommentarSkjema
            kommentar={del.larer?.kommentar ?? null}
            niva={del.larer?.niva ?? null}
            svarId={del.id}
          />
        </section>
      ))}
      <Link className="underline" href="/larer">
        Tilbake
      </Link>
    </Ramme>
  );
}
