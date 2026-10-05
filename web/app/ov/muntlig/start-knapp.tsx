"use client";

import { useActionState } from "react";
import { startMuntligOkt } from "./actions";

export function StartKnapp() {
  const [tilstand, handling, venter] = useActionState(
    async () => startMuntligOkt(),
    null,
  );

  return (
    <form action={handling}>
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter}
        type="submit"
      >
        {venter ? "Starter…" : "Start økt"}
      </button>
      {tilstand?.feil ? (
        <p className="mt-4" role="alert">
          {tilstand.feil}
        </p>
      ) : null}
    </form>
  );
}
