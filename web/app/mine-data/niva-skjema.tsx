"use client";

import { useActionState } from "react";
import { nivaer, type Niva } from "@/lib/personvern/mine-data";
import { lagreNiva } from "./actions";

export function NivaSkjema({ valgt }: { valgt: Niva | null }) {
  const [tilstand, handling, venter] = useActionState(lagreNiva, null);

  return (
    <form action={handling} className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend>Velg nivå</legend>
        {nivaer.map((niva) => (
          <label key={niva}>
            <input
              defaultChecked={valgt === niva}
              name="niva"
              required
              type="radio"
              value={niva}
            />{" "}
            {niva}
          </label>
        ))}
      </fieldset>
      <button
        className="w-fit rounded border border-current px-4 py-2 disabled:opacity-50"
        disabled={venter}
        type="submit"
      >
        {venter ? "Lagrer…" : "Lagre nivå"}
      </button>
      {tilstand?.feil ? <p role="alert">{tilstand.feil}</p> : null}
    </form>
  );
}
