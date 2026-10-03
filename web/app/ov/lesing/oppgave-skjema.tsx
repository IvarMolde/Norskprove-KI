"use client";

import { useState, useTransition } from "react";
import type { Leseoppgave } from "@/lib/oppgaver/pastand-korrekt";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { lagreSvar } from "./actions";

export function OppgaveSkjema({
  oktId,
  oppgave,
  gjennomgang,
}: {
  oktId: string;
  oppgave: Leseoppgave;
  gjennomgang: boolean;
}) {
  const [valg, setValg] = useState(oppgave.svar?.valg ?? []);
  const [feil, setFeil] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lagrer, startLagring] = useTransition();
  const [sender, startSending] = useTransition();
  const last = gjennomgang && oppgave.besvart;
  const alleValgt = oppgave.pastander.every((pastand) =>
    valg.some((rad) => rad.id === pastand.id),
  );

  function svarFor(id: string): boolean | null {
    const funnet = valg.find((rad) => rad.id === id);
    return funnet ? funnet.svar : null;
  }

  function velg(id: string, svar: boolean) {
    if (last) {
      return;
    }

    const neste = [...valg.filter((rad) => rad.id !== id), { id, svar }];
    setValg(neste);
    setFeil(null);
    setStatus("Lagrer…");

    startLagring(async () => {
      try {
        const resultat = await lagreSvar(oktId, oppgave.id, { valg: neste }, false);
        if (resultat?.feil) {
          setFeil(resultat.feil);
          setStatus(null);
          return;
        }
        setStatus("Lagret");
      } catch (error) {
        if (erOmdirigering(error)) {
          return;
        }
        setFeil("Noe gikk galt. Prøv igjen.");
        setStatus(null);
      }
    });
  }

  function sendInn() {
    setFeil(null);
    startSending(async () => {
      try {
        const resultat = await lagreSvar(oktId, oppgave.id, { valg }, true);
        if (resultat?.feil) {
          setFeil(resultat.feil);
          setStatus(null);
        }
      } catch (error) {
        if (erOmdirigering(error)) {
          return;
        }
        setFeil("Noe gikk galt. Prøv igjen.");
        setStatus(null);
      }
    });
  }

  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{oppgave.tittel}</h1>
      <p>{oppgave.tekst}</p>
      <p>Les teksten. Er påstanden riktig? Velg ja eller nei.</p>
      {oppgave.pastander.map((pastand) => {
        const fasit = oppgave.fasit?.find((rad) => rad.id === pastand.id);
        const mitt = svarFor(pastand.id);
        const riktig =
          last && fasit && mitt !== null ? mitt === fasit.korrekt : null;

        return (
          <fieldset
            className="flex flex-col gap-2 border border-current p-4"
            disabled={last || sender}
            key={pastand.id}
          >
            <legend className="px-1">{pastand.tekst}</legend>
            <label className="flex items-center gap-2">
              <input
                checked={mitt === true}
                name={pastand.id}
                onChange={() => velg(pastand.id, true)}
                type="radio"
              />
              Ja
            </label>
            <label className="flex items-center gap-2">
              <input
                checked={mitt === false}
                name={pastand.id}
                onChange={() => velg(pastand.id, false)}
                type="radio"
              />
              Nei
            </label>
            {riktig === true ? <p>Riktig</p> : null}
            {riktig === false ? <p>Feil</p> : null}
          </fieldset>
        );
      })}
      {status ? <p aria-live="polite">{status}</p> : null}
      {feil ? <p role="alert">{feil}</p> : null}
      {last ? null : (
        <>
          {alleValgt ? null : (
            <p>Velg ja eller nei på alle påstandene.</p>
          )}
          <button
            className="w-fit rounded border border-current px-4 py-2 disabled:opacity-50"
            disabled={!alleValgt || sender || lagrer}
            onClick={sendInn}
            type="button"
          >
            {sender ? "Sender…" : "Send inn svaret"}
          </button>
        </>
      )}
    </article>
  );
}
