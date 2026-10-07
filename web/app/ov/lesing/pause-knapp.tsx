"use client";

import { useActionState } from "react";
import { gjenopptaLeseokt, pauseLeseokt } from "./actions";

export function PauseKnapp({ oktId }: { oktId: string }) {
  const [tilstand, handling, venter] = useActionState(pauseLeseokt, null);

  return (
    <form action={handling}>
      <input name="oktId" type="hidden" value={oktId} />
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter}
        type="submit"
      >
        {venter ? "Pauser…" : "Pause"}
      </button>
      {tilstand?.feil ? (
        <p className="mt-4" role="alert">
          {tilstand.feil}
        </p>
      ) : null}
    </form>
  );
}

export function GjenopptaKnapp({ oktId }: { oktId: string }) {
  const [tilstand, handling, venter] = useActionState(gjenopptaLeseokt, null);

  return (
    <form action={handling}>
      <input name="oktId" type="hidden" value={oktId} />
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter}
        type="submit"
      >
        {venter ? "Fortsetter…" : "Fortsett økten"}
      </button>
      {tilstand?.feil ? (
        <p className="mt-4" role="alert">
          {tilstand.feil}
        </p>
      ) : null}
    </form>
  );
}