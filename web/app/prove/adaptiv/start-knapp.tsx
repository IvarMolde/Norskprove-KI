"use client";

import { useActionState } from "react";
import { startAdaptivProve } from "./actions";

export function StartKnapp({
  ferdighet,
}: {
  ferdighet: "lesing" | "lytting";
}) {
  const [tilstand, handling, venter] = useActionState(
    async () => startAdaptivProve(ferdighet),
    null,
  );
  const tekst = ferdighet === "lesing" ? "Start lesing" : "Start lytting";

  return (
    <form action={handling}>
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter}
        type="submit"
      >
        {venter ? "Starter…" : tekst}
      </button>
      {tilstand?.feil ? (
        <p className="mt-4" role="alert">
          {tilstand.feil}
        </p>
      ) : null}
    </form>
  );
}
