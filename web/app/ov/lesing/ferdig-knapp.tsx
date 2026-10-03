"use client";

import { useActionState } from "react";
import { fullforOkt } from "./actions";

export function FerdigKnapp({ oktId }: { oktId: string }) {
  const [tilstand, handling, venter] = useActionState(fullforOkt, null);

  return (
    <form action={handling}>
      <input name="oktId" type="hidden" value={oktId} />
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter}
        type="submit"
      >
        {venter ? "Henter resultatet…" : "Se resultatet"}
      </button>
      {tilstand?.feil ? (
        <p className="mt-4" role="alert">
          {tilstand.feil}
        </p>
      ) : null}
    </form>
  );
}
