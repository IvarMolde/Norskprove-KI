import Link from "next/link";
import { hentLyttePoengsum, hentLytteokt } from "@/lib/okt/lytting";
import { harRettighet } from "@/lib/rettigheter";
import { Ramme } from "../../lesing/ramme";
import { FerdigKnapp } from "../ferdig-knapp";
import { LydPastand } from "../lyd-pastand";
import { GjenopptaKnapp, PauseKnapp } from "../pause-knapp";

export default async function LytteOktPage({
  params,
  searchParams,
}: {
  params: Promise<{ oktId: string }>;
  searchParams: Promise<{ gjennomgang?: string }>;
}) {
  const { oktId } = await params;
  const { gjennomgang } = await searchParams;
  const resultat = await hentLytteokt(oktId);

  if (!resultat.ok) {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Øv på lytting</h1>
        <p role="alert">{resultat.feil}</p>
        <Link className="underline" href="/ov/lytting">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  const okt = resultat.data;
  const kanPause = await harRettighet("pause_gjenoppta");

  if (okt.status === "avbrutt_lagret") {
    return (
      <Ramme>
        <h1 className="text-2xl font-semibold">Økten er pauset</h1>
        <p>Oppgavene er de samme når du fortsetter.</p>
        {kanPause ? <GjenopptaKnapp oktId={okt.id} /> : null}
        <Link className="underline" href="/ov/lytting">
          Tilbake
        </Link>
      </Ramme>
    );
  }

  if (okt.status === "fullfort") {
    const poeng = await hentLyttePoengsum(okt.id);
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
        <Link className="underline" href="/ov/lytting">
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
        {kanPause ? <PauseKnapp oktId={okt.id} /> : null}
      </Ramme>
    );
  }

  const flereUbesvart = okt.oppgaver.some(
    (rad) => !rad.besvart && rad.id !== oppgave.id,
  );

  return (
    <Ramme>
      <LydPastand
        antall={okt.oppgaver.length}
        gjennomgang={Boolean(vist)}
        key={`${oppgave.id}:${vist ? "gjennomgang" : "svar"}`}
        oktId={okt.id}
        oppgave={oppgave}
      />
      {vist && flereUbesvart ? (
        <Link className="underline" href={`/ov/lytting/${okt.id}`}>
          Neste oppgave
        </Link>
      ) : null}
      {vist && !flereUbesvart ? <FerdigKnapp oktId={okt.id} /> : null}
      {kanPause ? <PauseKnapp oktId={okt.id} /> : null}
    </Ramme>
  );
}
