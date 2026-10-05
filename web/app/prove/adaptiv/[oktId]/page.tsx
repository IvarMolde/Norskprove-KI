import Link from "next/link";
import { delTekst, videreAdaptivFase } from "@/lib/adaptiv";
import { hentLeseokt } from "@/lib/okt/lesing";
import { OppgaveSkjema } from "../../../ov/lesing/oppgave-skjema";
import { Ramme } from "../../../ov/lesing/ramme";

export default async function AdaptivOktSide({
  params,
  searchParams,
}: {
  params: Promise<{ oktId: string }>;
  searchParams: Promise<{ gjennomgang?: string }>;
}) {
  const { oktId } = await params;
  const { gjennomgang } = await searchParams;
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

  const lesing = await hentLeseokt(oktId);
  if (!lesing.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Adaptiv prøve</h1>
        <p role="alert">{lesing.feil}</p>
        <Link className="underline" href="/prove/adaptiv">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const vist = gjennomgang
    ? lesing.data.oppgaver.find((oppgave) => oppgave.id === gjennomgang && oppgave.besvart)
    : undefined;

  if (prove.data.status === "fullfort" && !vist) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Nivågruppen din</h1>
        <p>Dette er øving. Det er ikke et offisielt resultat.</p>
        {prove.data.niva_gruppe ? (
          <p>Nivågruppen din er {prove.data.niva_gruppe}.</p>
        ) : (
          <p role="alert">Noe gikk galt. Prøv igjen.</p>
        )}
        <Link className="underline" href="/prove/adaptiv">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const faseIder = new Set(prove.data.oppgaver);
  const faseOppgaver = lesing.data.oppgaver.filter((oppgave) => faseIder.has(oppgave.id));
  const neste = faseOppgaver.find((oppgave) => !oppgave.besvart);
  const oppgave = vist ?? neste;

  if (!oppgave) {
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

  const nummer = faseOppgaver.findIndex((rad) => rad.id === oppgave.id);
  const visning =
    nummer >= 0 ? { ...oppgave, rekkefolge: nummer + 1 } : { ...oppgave, rekkefolge: 1 };
  const antall = nummer >= 0 ? faseOppgaver.length : 1;

  return (
    <Ramme>
      <p>{vist ? "Svaret ditt" : delTekst(prove.data.fase)}</p>
      <OppgaveSkjema
        antall={antall}
        gjennomgang={Boolean(vist)}
        key={`${oppgave.id}:${vist ? "gjennomgang" : "svar"}`}
        oktId={oktId}
        oppgave={visning}
      />
      {vist ? (
        <Link className="underline" href={`/prove/adaptiv/${oktId}`}>
          {prove.data.status === "fullfort" ? "Se resultatet" : "Neste oppgave"}
        </Link>
      ) : null}
    </Ramme>
  );
}
