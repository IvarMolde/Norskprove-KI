"use client";

import { useActionState } from "react";
import { kjopPlan } from "./actions";

export function KjopKnapp({
  planId,
  navn,
}: {
  planId: string;
  navn: string;
}) {
  const [tilstand, handling, venter] = useActionState(kjopPlan, null);

  return (
    <form action={handling} className="flex flex-col gap-2">
      <input name="planId" type="hidden" value={planId} />
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter}
        type="submit"
      >
        {venter ? "Venter…" : `Kjøp ${navn}`}
      </button>
      {tilstand?.feil ? <p role="alert">{tilstand.feil}</p> : null}
    </form>
  );
}