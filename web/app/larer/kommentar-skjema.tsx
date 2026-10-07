"use client";

import { useActionState } from "react";
import { sendLarerKommentar } from "./actions";

const NIVA = ["Under A1", "A1", "A2", "B1", "B2"] as const;

export function KommentarSkjema({
  svarId,
  niva,
  kommentar,
}: {
  svarId: string;
  niva: string | null;
  kommentar: string | null;
}) {
  const [tilstand, handling, venter] = useActionState(sendLarerKommentar, null);

  const feltId = `kommentar-${svarId}`;

  return (
    <form
      action={handling}
      className="flex flex-col gap-4"
      onReset={(hendelse) => {
        hendelse.preventDefault();
      }}
    >
      <h2 className="text-xl font-semibold">Kommentar til eleven</h2>
      <input name="svarId" type="hidden" value={svarId} />
      <fieldset className="flex flex-col gap-2">
        <legend>Nivå du setter</legend>
        {NIVA.map((valg) => (
          <label key={valg}>
            <input
              defaultChecked={niva === valg}
              disabled={venter}
              name="niva"
              required
              type="radio"
              value={valg}
            />{" "}
            {valg}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-2" htmlFor={feltId}>
        Skriv til eleven
        <textarea
          className="min-h-32 w-full rounded border border-current p-3"
          defaultValue={kommentar ?? ""}
          disabled={venter}
          id={feltId}
          maxLength={1000}
          name="kommentar"
          required
          rows={6}
        />
      </label>
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter}
        type="submit"
      >
        {venter ? "Sender…" : "Send til eleven"}
      </button>
      {tilstand?.feil ? <p role="alert">{tilstand.feil}</p> : null}
    </form>
  );
}
