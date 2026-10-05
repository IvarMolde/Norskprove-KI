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
      <h1 className="text-2xl font-semibold">{rad.tittel}</h1>
      {rad.ny ? <p><strong>Ny</strong></p> : null}
      <p>{rad.epost}</p>
      <p>{datoTekst(rad.innsendt)}</p>
      <p>{rad.oppgavetekst}</p>
      {rad.bilde ? (
        <MuntligBilde beskrivelse={rad.bilde.beskrivelse} url={rad.bilde.url} />
      ) : null}
      <audio controls preload="none" src={`/larer/lyd/${rad.id}`}>
        Nettleseren kan ikke spille av lyden.
      </audio>
      <h2 className="text-xl font-semibold">Teksten eleven sa</h2>
      <p className="whitespace-pre-wrap">{rad.svar}</p>
      {sendt === "1" ? <p>Kommentaren er sendt.</p> : null}
      <KommentarSkjema
        kommentar={rad.larer?.kommentar ?? null}
        niva={rad.larer?.niva ?? null}
        svarId={rad.id}
      />
      <Link className="underline" href="/larer">
        Tilbake
      </Link>
    </Ramme>
  );
}
