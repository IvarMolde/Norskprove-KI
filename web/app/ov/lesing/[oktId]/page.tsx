import Link from "next/link";
import { hentLeseokt, hentPoengsum } from "@/lib/okt/lesing";
import { FerdigKnapp } from "../ferdig-knapp";
import { OppgaveSkjema } from "../oppgave-skjema";
import { Ramme } from "../ramme";

export default async function OktPage({
  params,
  searchParams,
}: {
  params: Promise<{ oktId: string }>;
  searchParams: Promise<{ gjennomgang?: string }>;
}) {
  const { oktId } = await params;
  const { gjennomgang } = await searchParams;
  const resultat = await hentLeseokt(oktId);

  if (!resultat.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på lesing</h1>
        <p role="alert">{resultat.feil}</p>
        <Link className="underline" href="/ov/lesing">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const okt = resultat.data;

  if (okt.status === "fullfort") {
    const poeng = await hentPoengsum(okt.id);
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Resultatet</h1>
        {poeng.ok ? (
          <p>
            Du fikk {poeng.data.riktige} av {poeng.data.mulige} riktige.
          </p>
        ) : (
          <p role="alert">{poeng.feil}</p>
        )}
        <Link className="underline" href="/ov/lesing">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const vist = gjennomgang
    ? okt.oppgaver.find((oppgave) => oppgave.id === gjennomgang && oppgave.besvart)
    : undefined;
  const nesteUbesvart = okt.oppgaver.find((oppgave) => !oppgave.besvart);
  const oppgave = vist ?? nesteUbesvart;

  if (!oppgave) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Økten er klar</h1>
        <p>Du har svart på alle oppgavene.</p>
        <FerdigKnapp oktId={okt.id} />
      </Ramme>
    );
  }

  const flereUbesvart = okt.oppgaver.some(
    (rad) => !rad.besvart && rad.id !== oppgave.id,
  );

  return (
    <Ramme>
      <OppgaveSkjema
        gjennomgang={Boolean(vist)}
        key={`${oppgave.id}:${vist ? "gjennomgang" : "svar"}`}
        oktId={okt.id}
        oppgave={oppgave}
      />
      {vist && flereUbesvart ? (
        <Link className="underline" href={`/ov/lesing/${okt.id}`}>
          Neste oppgave
        </Link>
      ) : null}
      {vist && !flereUbesvart ? <FerdigKnapp oktId={okt.id} /> : null}
    </Ramme>
  );
}
