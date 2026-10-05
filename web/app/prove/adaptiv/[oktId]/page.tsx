import Link from "next/link";
import {
  delTekst,
  hentAdaptivProve,
  videreAdaptivFase,
  type AdaptivTilstand,
} from "@/lib/adaptiv";
import { hentLeseokt } from "@/lib/okt/lesing";
import { hentLytteokt } from "@/lib/okt/lytting";
import type { Leseoppgave } from "@/lib/oppgaver/lesing";
import type { LyttePastand } from "@/lib/oppgaver/lytting";
import { harRettighet } from "@/lib/rettigheter";
import { OppgaveSkjema } from "../../../ov/lesing/oppgave-skjema";
import { Ramme } from "../../../ov/lesing/ramme";
import { LydPastand } from "../../../ov/lytting/lyd-pastand";
import { GjenopptaKnapp, PauseKnapp } from "../pause-knapp";

type Rad = { id: string; besvart: boolean; rekkefolge: number };

function velgOppgave<T extends Rad>(
  oppgaver: T[],
  faseIder: Set<string>,
  gjennomgang: string | undefined,
) {
  const vist = gjennomgang
    ? oppgaver.find((oppgave) => oppgave.id === gjennomgang && oppgave.besvart)
    : undefined;
  const faseOppgaver = oppgaver.filter((oppgave) => faseIder.has(oppgave.id));
  const neste = faseOppgaver.find((oppgave) => !oppgave.besvart);
  const oppgave = vist ?? neste;
  if (!oppgave) {
    return null;
  }
  const nummer = faseOppgaver.findIndex((rad) => rad.id === oppgave.id);
  return {
    vist: Boolean(vist),
    visning: { ...oppgave, rekkefolge: nummer >= 0 ? nummer + 1 : 1 },
    antall: nummer >= 0 ? faseOppgaver.length : 1,
  };
}

function Resultat({ prove }: { prove: AdaptivTilstand }) {
  return (
    <Ramme>
      <h1 className="text-2xl font-semibold">Nivågruppen din</h1>
      <p>{prove.ferdighet === "lytting" ? "Lytting" : "Lesing"}</p>
      <p>Dette er øving. Det er ikke et offisielt resultat.</p>
      {prove.niva_gruppe ? (
        <p>Nivågruppen din er {prove.niva_gruppe}.</p>
      ) : (
        <p role="alert">Noe gikk galt. Prøv igjen.</p>
      )}
      <Link className="underline" href="/prove/adaptiv">
        Tilbake
      </Link>
    </Ramme>
  );
}

export default async function AdaptivOktSide({
  params,
  searchParams,
}: {
  params: Promise<{ oktId: string }>;
  searchParams: Promise<{ gjennomgang?: string }>;
}) {
  const { oktId } = await params;
  const { gjennomgang } = await searchParams;
  const hentet = await hentAdaptivProve(oktId);

  if (!hentet.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Adaptiv prøve</h1>
        <p role="alert">{hentet.feil}</p>
        <Link className="underline" href="/prove/adaptiv">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const kanPause = await harRettighet("pause_gjenoppta");

  if (hentet.data.status === "avbrutt_lagret") {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Økten er pauset</h1>
        <p>Oppgavene er de samme når du fortsetter.</p>
        {kanPause ? <GjenopptaKnapp oktId={hentet.data.id} /> : null}
        <Link className="underline" href="/prove/adaptiv">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const prove = await videreAdaptivFase(oktId);

  if (!prove.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Adaptiv prøve</h1>
        <p role="alert">{prove.feil}</p>
        <Link className="underline" href="/prove/adaptiv">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const oppgaver =
    prove.data.ferdighet === "lytting"
      ? await hentLytteokt(oktId)
      : await hentLeseokt(oktId);

  if (!oppgaver.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Adaptiv prøve</h1>
        <p role="alert">{oppgaver.feil}</p>
        <Link className="underline" href="/prove/adaptiv">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const valgt = velgOppgave(oppgaver.data.oppgaver, new Set(prove.data.oppgaver), gjennomgang);

  if (prove.data.status === "fullfort" && !valgt?.vist) {
    return <Resultat prove={prove.data} />;
  }

  if (!valgt) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Adaptiv prøve</h1>
        <p role="alert">Noe gikk galt. Prøv igjen.</p>
        <Link className="underline" href="/prove/adaptiv">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  return (
    <Ramme>
      <p>{valgt.vist ? "Svaret ditt" : delTekst(prove.data.fase)}</p>
      {prove.data.ferdighet === "lytting" ? (
        <LydPastand
          antall={valgt.antall}
          gjennomgang={valgt.vist}
          key={`${valgt.visning.id}:${valgt.vist ? "gjennomgang" : "svar"}`}
          oktId={oktId}
          oppgave={valgt.visning as LyttePastand}
        />
      ) : (
        <OppgaveSkjema
          antall={valgt.antall}
          gjennomgang={valgt.vist}
          key={`${valgt.visning.id}:${valgt.vist ? "gjennomgang" : "svar"}`}
          oktId={oktId}
          oppgave={valgt.visning as Leseoppgave}
        />
      )}
      {valgt.vist ? (
        <Link className="underline" href={`/prove/adaptiv/${oktId}`}>
          {prove.data.status === "fullfort" ? "Se resultatet" : "Neste oppgave"}
        </Link>
      ) : null}
      {prove.data.status === "pagaende" && kanPause ? <PauseKnapp oktId={oktId} /> : null}
    </Ramme>
  );
}
