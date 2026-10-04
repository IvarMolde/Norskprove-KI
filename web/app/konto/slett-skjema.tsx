"use client";

import { useState } from "react";
import { useActionState } from "react";
import { slettKonto } from "./actions";

export function SlettSkjema() {
  const [bekreftet, setBekreftet] = useState(false);
  const [tilstand, handling, venter] = useActionState(slettKonto, null);

  return (
    <form action={handling} className="flex flex-col gap-4">
      <label>
        <input
          checked={bekreftet}
          name="bekreft"
          onChange={(event) => setBekreftet(event.target.checked)}
          type="checkbox"
          value="ja"
        />{" "}
        Jeg vil slette kontoen min
      </label>
      <button
        className="w-fit rounded border border-current px-4 py-2 disabled:opacity-50"
        disabled={!bekreftet || venter}
        type="submit"
      >
        {venter ? "Sletter…" : "Slett kontoen"}
      </button>
      {tilstand?.feil ? <p role="alert">{tilstand.feil}</p> : null}
    </form>
  );
}
