"use client";

import { useState } from "react";
import type { RekkefolgeOppgave } from "@/lib/oppgaver/lesing";
import { LagreLinje } from "./lagre-linje";
import { useOppgaveLagring } from "./use-lagring";

export function RekkefolgeSkjema({
  oktId,
  oppgave,
  gjennomgang,
}: {
  oktId: string;
  oppgave: RekkefolgeOppgave;
  gjennomgang: boolean;
}) {
  const [rekkefolge, setRekkefolge] = useState(
    oppgave.svar?.rekkefolge ?? oppgave.ledd.map((ledd) => ledd.id),
  );
  const { feil, status, lagrer, sender, lagre } = useOppgaveLagring(
    oktId,
    oppgave.id,
  );
  const last = gjennomgang && oppgave.besvart;
  const riktig =
    last && oppgave.fasit
      ? rekkefolge.join("|") === oppgave.fasit.riktig.join("|")
      : null;

  function flytt(index: number, retning: -1 | 1) {
    const maal = index + retning;
    if (last || maal < 0 || maal >= rekkefolge.length) {
      return;
    }
    const neste = [...rekkefolge];
    const [flyttet] = neste.splice(index, 1);
    if (!flyttet) {
      return;
    }
    neste.splice(maal, 0, flyttet);
    setRekkefolge(neste);
    lagre({ rekkefolge: neste }, false);
  }

  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{oppgave.tittel}</h1>
      <p>Sett setningene i riktig rekkefølge. Bruk knappene Opp og Ned.</p>
      <ol className="flex flex-col gap-3">
        {rekkefolge.map((id, index) => {
          const ledd = oppgave.ledd.find((rad) => rad.id === id);
          if (!ledd) {
            return null;
          }
          return (
            <li className="flex flex-wrap items-center gap-3 border border-current p-3" key={id}>
              <p className="min-w-48 flex-1">{ledd.tekst}</p>
              {last ? null : (
                <>
                  <button
                    className="rounded border border-current px-3 py-1 disabled:opacity-50"
                    disabled={index === 0 || lagrer || sender}
                    onClick={() => flytt(index, -1)}
                    type="button"
                  >
                    Opp
                  </button>
                  <button
                    className="rounded border border-current px-3 py-1 disabled:opacity-50"
                    disabled={index === rekkefolge.length - 1 || lagrer || sender}
                    onClick={() => flytt(index, 1)}
                    type="button"
                  >
                    Ned
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {riktig === true ? <p>Riktig</p> : null}
      {riktig === false && oppgave.fasit ? (
        <div>
          <p>Feil. Riktig rekkefølge:</p>
          <ol className="list-decimal pl-6">
            {oppgave.fasit.riktig.map((id) => (
              <li key={id}>
                {oppgave.ledd.find((ledd) => ledd.id === id)?.tekst}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <LagreLinje feil={feil} status={status} />
      {last ? null : (
        <button
          className="w-fit rounded border border-current px-4 py-2 disabled:opacity-50"
          disabled={sender || lagrer}
          onClick={() => lagre({ rekkefolge }, true)}
          type="button"
        >
          {sender ? "Sender…" : "Send inn svaret"}
        </button>
      )}
    </article>
  );
}
