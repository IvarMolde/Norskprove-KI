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

  const { oppgave, status } = resultat.data;
  const vurdering = oppgave.vurdering;

  if (status !== "pagaende" && !vurdering) {
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

  if (status === "fullfort" && vurdering) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Din vurdering</h1>
        <h2 className="text-xl font-semibold">{oppgave.tittel}</h2>
        {oppgave.bilde ? (
          <MuntligBilde
            beskrivelse={oppgave.bilde.beskrivelse}
            endelse={oppgave.bilde.endelse}
            url={oppgave.bilde.url}
          />
        ) : null}
        <p>Nivå: {vurdering.samlet_niva}</p>
        {vurdering.usikker_vurdering ? <p>Vi er ikke sikre på vurderingen.</p> : null}
        {vurdering.usikker_pga_lyd ? <p>Vi er ikke sikre på uttale og flyt.</p> : null}
        <p>{vurdering.tilbakemelding_til_elev}</p>
        <h2 className="text-xl font-semibold">Dette kan du øve på</h2>
        <ol className="list-decimal pl-6">
          {vurdering.forbedringspunkter.map((punkt, index) => (
            <li key={`${index}:${punkt}`}>{punkt}</li>
          ))}
        </ol>
        <p>Bra: {vurdering.positivt_element}</p>
        <h2 className="text-xl font-semibold">Fra læreren</h2>
        {oppgave.larer ? (
          <>
            <p>Nivå: {oppgave.larer.niva}</p>
            <p className="whitespace-pre-wrap">{oppgave.larer.kommentar}</p>
          </>
        ) : (
          <p>Læreren har ikke skrevet noe ennå.</p>
        )}
        <h2 className="text-xl font-semibold">Teksten du sa</h2>
        <p className="whitespace-pre-wrap">{oppgave.svar}</p>
        {oppgave.har_lyd ? <p>Opptaket er lagret.</p> : null}
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
        bilde={oppgave.bilde}
        oktId={resultat.data.id}
        oppgaveId={oppgave.id}
        tekst={oppgave.tekst}
        tittel={oppgave.tittel}
      />
    </Ramme>
  );
}
