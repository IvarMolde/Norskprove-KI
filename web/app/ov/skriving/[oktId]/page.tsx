import Link from "next/link";
import { hentSkriveokt } from "@/lib/okt/skriving";
import { harRettighet } from "@/lib/rettigheter";
import { Ramme } from "../../lesing/ramme";
import { GjenopptaKnapp, PauseKnapp } from "../pause-knapp";
import { SkriveSkjema } from "../skjema";

export const maxDuration = 300;

export default async function SkriveOktPage({
  params,
}: {
  params: Promise<{ oktId: string }>;
}) {
  const { oktId } = await params;
  const resultat = await hentSkriveokt(oktId);

  if (!resultat.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på skriving</h1>
        <p role="alert">{resultat.feil}</p>
        <Link className="underline" href="/ov/skriving">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const { oppgave, status } = resultat.data;
  const vurdering = oppgave.vurdering;
  const kanPause = await harRettighet("pause_gjenoppta");

  if (status === "avbrutt_lagret") {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Økten er pauset</h1>
        <p>Oppgavene er de samme når du fortsetter.</p>
        {kanPause ? <GjenopptaKnapp oktId={resultat.data.id} /> : null}
        <Link className="underline" href="/ov/skriving">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  if (status !== "pagaende" && !vurdering) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på skriving</h1>
        <p role="alert">Noe gikk galt. Prøv igjen.</p>
        <Link className="underline" href="/ov/skriving">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  if (status === "fullfort" && vurdering) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Din vurdering</h1>
        <p>Nivå: {vurdering.samlet_niva}</p>
        {vurdering.usikker_vurdering ? (
          <p>Vi er ikke sikre på vurderingen.</p>
        ) : null}
        <p>{vurdering.tilbakemelding_til_elev}</p>
        <h2 className="text-xl font-semibold">Dette kan du øve på</h2>
        <ol className="list-decimal pl-6">
          {vurdering.forbedringspunkter.map((punkt, index) => (
            <li key={`${index}:${punkt}`}>{punkt}</li>
          ))}
        </ol>
        <p>Bra: {vurdering.positivt_element}</p>
        <h2 className="text-xl font-semibold">Din tekst</h2>
        <p className="whitespace-pre-wrap">{oppgave.svar}</p>
        <Link className="underline" href="/ov/skriving">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Øv på skriving</h1>
      <SkriveSkjema
        kladd={oppgave.kladd ?? ""}
        oktId={resultat.data.id}
        oppgaveId={oppgave.id}
        tekst={oppgave.tekst}
        tittel={oppgave.tittel}
      />
      {kanPause ? <PauseKnapp oktId={resultat.data.id} /> : null}
    </Ramme>
  );
}
