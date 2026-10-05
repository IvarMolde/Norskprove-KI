import Link from "next/link";
import { oktFeilTekst } from "@/lib/okt/feil";
import { hentMuntligOkt } from "@/lib/okt/muntlig";
import { Ramme } from "../../lesing/ramme";
import { MuntligBilde } from "../bilde";
import { MuntligSkjema } from "../skjema";

export const maxDuration = 300;

export default async function MuntligOktPage({
  params,
}: {
  params: Promise<{ oktId: string }>;
}) {
  const { oktId } = await params;
  const resultat = await hentMuntligOkt(oktId);

  if (!resultat.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på muntlig</h1>
        <p role="alert">{resultat.feil}</p>
        <Link className="underline" href="/ov/muntlig">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const { oppgave, status, deler, nummer, antall } = resultat.data;

  if (status !== "pagaende" && deler.some((del) => !del.vurdering)) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på muntlig</h1>
        <p role="alert">Noe gikk galt. Prøv igjen.</p>
        <Link className="underline" href="/ov/muntlig">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  if (status === "fullfort") {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Din vurdering</h1>
        {deler.map((del, index) => {
          const vurdering = del.vurdering;
          if (!vurdering) {
            return null;
          }
          return (
            <section className="flex flex-col gap-4" key={del.id}>
              <h2 className="text-xl font-semibold">
                Oppgave {index + 1}: {del.tittel}
              </h2>
              {del.bilde ? (
                <MuntligBilde
                  beskrivelse={del.bilde.beskrivelse}
                  endelse={del.bilde.endelse}
                  url={del.bilde.url}
                />
              ) : null}
              <p>Nivå: {vurdering.samlet_niva}</p>
              {vurdering.usikker_vurdering ? <p>Vi er ikke sikre på vurderingen.</p> : null}
              {vurdering.usikker_pga_lyd ? <p>Vi er ikke sikre på uttale og flyt.</p> : null}
              <p>{vurdering.tilbakemelding_til_elev}</p>
              <h3 className="text-lg font-semibold">Dette kan du øve på</h3>
              <ol className="list-decimal pl-6">
                {vurdering.forbedringspunkter.map((punkt, punktIndex) => (
                  <li key={`${punktIndex}:${punkt}`}>{punkt}</li>
                ))}
              </ol>
              <p>Bra: {vurdering.positivt_element}</p>
              <h3 className="text-lg font-semibold">Fra læreren</h3>
              {del.larer ? (
                <>
                  <p>Nivå: {del.larer.niva}</p>
                  <p className="whitespace-pre-wrap">{del.larer.kommentar}</p>
                </>
              ) : (
                <p>Læreren har ikke skrevet noe ennå.</p>
              )}
              <h3 className="text-lg font-semibold">Teksten du sa</h3>
              <p className="whitespace-pre-wrap">{del.svar}</p>
              {del.har_lyd ? <p>Opptaket er lagret.</p> : null}
            </section>
          );
        })}
        <Link className="underline" href="/ov/muntlig">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  if (oppgave.oppgavetype === "individuell_beskrive_bilde" && !oppgave.bilde) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på muntlig</h1>
        <p role="alert">{oktFeilTekst("bilde_mangler")}</p>
        <Link className="underline" href="/ov/muntlig">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Øv på muntlig</h1>
      <MuntligSkjema
        antall={antall}
        bilde={oppgave.bilde}
        nummer={nummer}
        oktId={resultat.data.id}
        oppgaveId={oppgave.id}
        tekst={oppgave.tekst}
        tittel={oppgave.tittel}
      />
    </Ramme>
  );
}
