"use client";

import type { Leseoppgave } from "@/lib/oppgaver/lesing";
import { FyllInnSkjema } from "./fyll-inn-skjema";
import { OrdvalgSkjema } from "./ordvalg-skjema";
import { PastandSkjema } from "./pastand-skjema";
import { RekkefolgeSkjema } from "./rekkefolge-skjema";

export function OppgaveSkjema({
  oktId,
  oppgave,
  gjennomgang,
  antall,
}: {
  oktId: string;
  oppgave: Leseoppgave;
  gjennomgang: boolean;
  antall: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p>
        Oppgave {oppgave.rekkefolge} av {antall}
      </p>
      {oppgave.type === "pastand_korrekt" ? (
        <PastandSkjema
          gjennomgang={gjennomgang}
          oktId={oktId}
          oppgave={oppgave}
        />
      ) : null}
      {oppgave.type === "fyll_inn" ? (
        <FyllInnSkjema
          gjennomgang={gjennomgang}
          oktId={oktId}
          oppgave={oppgave}
        />
      ) : null}
      {oppgave.type === "synonym" || oppgave.type === "antonym" ? (
        <OrdvalgSkjema
          gjennomgang={gjennomgang}
          oktId={oktId}
          oppgave={oppgave}
        />
      ) : null}
      {oppgave.type === "rekkefolge" ? (
        <RekkefolgeSkjema
          gjennomgang={gjennomgang}
          oktId={oktId}
          oppgave={oppgave}
        />
      ) : null}
    </div>
  );
}
