"use client";

import { useState } from "react";
import type { LyttePastand } from "@/lib/oppgaver/lytting";
import { LagreLinje } from "../lesing/lagre-linje";
import { useLytteLagring } from "./use-lagring";

export function LydPastand({
  oktId,
  oppgave,
  gjennomgang,
  antall,
}: {
  oktId: string;
  oppgave: LyttePastand;
  gjennomgang: boolean;
  antall: number;
}) {
  const [valg, setValg] = useState(oppgave.svar?.valg ?? []);
  const { feil, status, lagrer, sender, lagre } = useLytteLagring(
    oktId,
    oppgave.id,
  );
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
    lagre({ valg: neste }, false);
  }

  return (
    <article className="flex flex-col gap-6">
      <p>
        Oppgave {oppgave.rekkefolge} av {antall}
      </p>
      <h1 className="text-2xl font-semibold">{oppgave.tittel}</h1>
      <figure className="flex flex-col gap-2">
        <figcaption>Lydfil</figcaption>
        <audio controls preload="metadata" src={oppgave.lyd_url}>
          <a href={oppgave.lyd_url}>Spill av lyden</a>
        </audio>
      </figure>
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Teksten</h2>
        <p>{oppgave.transkripsjon}</p>
      </section>
      <p>Lytt til lydfilen. Er påstanden riktig? Velg ja eller nei.</p>
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
      <LagreLinje feil={feil} status={status} />
      {last ? null : (
        <>
          {alleValgt ? null : <p>Velg ja eller nei på alle påstandene.</p>}
          <button
            className="w-fit rounded border border-current px-4 py-2 disabled:opacity-50"
            disabled={!alleValgt || sender || lagrer}
            onClick={() => lagre({ valg }, true)}
            type="button"
          >
            {sender ? "Sender…" : "Send inn svaret"}
          </button>
        </>
      )}
    </article>
  );
}
