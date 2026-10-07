"use client";

import { useRef, useState } from "react";
import type { FyllInnOppgave } from "@/lib/oppgaver/lesing";
import { ordErGodkjent } from "@/lib/oppgaver/ord";
import { LagreLinje } from "./lagre-linje";
import { useOppgaveLagring } from "./use-lagring";

export function FyllInnSkjema({
  oktId,
  oppgave,
  gjennomgang,
}: {
  oktId: string;
  oppgave: FyllInnOppgave;
  gjennomgang: boolean;
}) {
  const [hull, setHull] = useState(oppgave.svar?.hull ?? []);
  const hullRef = useRef(hull);
  const { feil, status, lagrer, sender, lagre } = useOppgaveLagring(
    oktId,
    oppgave.id,
  );
  const last = gjennomgang && oppgave.besvart;
  const hullIOppgave = oppgave.deler.filter((del) => del.type === "hull");
  const alleFylt = hullIOppgave.every((del) => {
    const svar = hull.find((rad) => rad.id === del.id)?.svar ?? "";
    return svar.trim().length > 0;
  });

  function skriv(id: string, svar: string) {
    if (last) {
      return;
    }
    const neste = [
      ...hullRef.current.filter((rad) => rad.id !== id),
      { id, svar },
    ];
    hullRef.current = neste;
    setHull(neste);
    lagre({ hull: neste }, false);
  }

  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{oppgave.tittel}</h1>
      <p>{oppgave.tekst}</p>
      <p>Skriv ordet som mangler.</p>
      <p className="flex flex-wrap items-center gap-2">
        {oppgave.deler.map((del, index) => {
          if (del.type === "tekst") {
            return <span key={`${del.tekst}-${index}`}>{del.tekst}</span>;
          }

          const verdi = hull.find((rad) => rad.id === del.id)?.svar ?? "";
          const fasit = oppgave.fasit?.find((rad) => rad.id === del.id);
          const riktig =
            last && fasit ? ordErGodkjent(verdi, fasit.ord) : null;

          return (
            <label className="inline-flex flex-col gap-1" key={del.id}>
              <span className="sr-only">Ord som mangler</span>
              <input
                className="rounded border border-current px-2 py-1"
                disabled={last || sender}
                onChange={(event) => skriv(del.id, event.target.value)}
                value={verdi}
              />
              {riktig === true ? <span>Riktig</span> : null}
              {riktig === false ? (
                <span>Feil. Riktig svar: {fasit?.ord[0]}</span>
              ) : null}
            </label>
          );
        })}
      </p>
      <LagreLinje feil={feil} status={status} />
      {last ? null : (
        <button
          className="w-fit rounded border border-current px-4 py-2 disabled:opacity-50"
          disabled={!alleFylt || sender || lagrer}
          onClick={() => lagre({ hull: hullRef.current }, true)}
          type="button"
        >
          {sender ? "Sender…" : "Send inn svaret"}
        </button>
      )}
    </article>
  );
}
