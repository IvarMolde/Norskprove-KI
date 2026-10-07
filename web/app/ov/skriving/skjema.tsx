"use client";

import { useActionState, useEffect } from "react";
import { LagreLinje } from "../lesing/lagre-linje";
import { useTekstkladd } from "../use-tekstkladd";
import { sendSkrivesvar } from "./actions";

export function SkriveSkjema({
  oktId,
  oppgaveId,
  tittel,
  tekst,
  kladd,
}: {
  oktId: string;
  oppgaveId: string;
  tittel: string;
  tekst: string;
  kladd: string;
}) {
  const [tilstand, handling, venter] = useActionState(sendSkrivesvar, null);
  const { tekst: verdi, oppdater, status, feil, settAktiv } = useTekstkladd(
    oktId,
    oppgaveId,
    kladd,
  );

  useEffect(() => {
    settAktiv(!venter);
  }, [settAktiv, venter]);

  return (
    <form action={handling} className="flex flex-col gap-4">
      <p>Oppgave 1 av 1</p>
      <h2 className="text-xl font-semibold">{tittel}</h2>
      <p>{tekst}</p>
      <input name="oktId" type="hidden" value={oktId} />
      <input name="oppgaveId" type="hidden" value={oppgaveId} />
      <label className="flex flex-col gap-2" htmlFor="tekst">
        Din tekst
        <textarea
          className="min-h-40 w-full rounded border border-current p-3"
          disabled={venter}
          id="tekst"
          maxLength={4000}
          name="tekst"
          onChange={(event) => oppdater(event.target.value)}
          required
          rows={8}
          value={verdi}
        />
      </label>
      <LagreLinje feil={feil} status={venter ? null : status} />
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter}
        type="submit"
      >
        {venter ? "Sender…" : "Send inn"}
      </button>
      {tilstand?.feil ? <p role="alert">{tilstand.feil}</p> : null}
    </form>
  );
}
