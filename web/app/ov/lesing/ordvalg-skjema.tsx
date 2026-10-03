"use client";

import { useState } from "react";
import type { OrdvalgOppgave } from "@/lib/oppgaver/lesing";
import { LagreLinje } from "./lagre-linje";
import { useOppgaveLagring } from "./use-lagring";

export function OrdvalgSkjema({
  oktId,
  oppgave,
  gjennomgang,
}: {
  oktId: string;
  oppgave: OrdvalgOppgave;
  gjennomgang: boolean;
}) {
  const [valgId, setValgId] = useState(oppgave.svar?.valgId ?? "");
  const { feil, status, lagrer, sender, lagre } = useOppgaveLagring(
    oktId,
    oppgave.id,
  );
  const last = gjennomgang && oppgave.besvart;
  const riktigValg = oppgave.fasit?.korrekt;
  const valgtErRiktig =
    last && riktigValg ? valgId === riktigValg : null;
  const riktigTekst = oppgave.alternativer.find(
    (alt) => alt.id === riktigValg,
  )?.tekst;
  const hjelp =
    oppgave.type === "synonym"
      ? "Velg ordet som betyr det samme."
      : "Velg ordet som betyr det motsatte.";

  function velg(id: string) {
    if (last) {
      return;
    }
    setValgId(id);
    lagre({ valgId: id }, false);
  }

  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{oppgave.ord}</h1>
      <p>{oppgave.tekst}</p>
      <p>{hjelp}</p>
      <fieldset className="flex flex-col gap-2" disabled={last || sender}>
        <legend className="sr-only">{hjelp}</legend>
        {oppgave.alternativer.map((alt) => (
          <label className="flex items-center gap-2" key={alt.id}>
            <input
              checked={valgId === alt.id}
              name={oppgave.id}
              onChange={() => velg(alt.id)}
              type="radio"
            />
            {alt.tekst}
          </label>
        ))}
      </fieldset>
      {valgtErRiktig === true ? <p>Riktig</p> : null}
      {valgtErRiktig === false ? <p>Feil. Riktig svar: {riktigTekst}</p> : null}
      <LagreLinje feil={feil} status={status} />
      {last ? null : (
        <button
          className="w-fit rounded border border-current px-4 py-2 disabled:opacity-50"
          disabled={valgId.length === 0 || sender || lagrer}
          onClick={() => lagre({ valgId }, true)}
          type="button"
        >
          {sender ? "Sender…" : "Send inn svaret"}
        </button>
      )}
    </article>
  );
}
