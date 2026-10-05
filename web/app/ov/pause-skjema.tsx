"use client";

import { useActionState } from "react";

type Handling = (
  forrige: { feil: string } | null,
  formData: FormData,
) => Promise<{ feil: string } | null>;

export function PauseSkjema({
  oktId,
  handling,
  etikett,
  venterTekst,
}: {
  oktId: string;
  handling: Handling;
  etikett: string;
  venterTekst: string;
}) {
  const [tilstand, send, venter] = useActionState(handling, null);

  return (
    <form action={send}>
      <input name="oktId" type="hidden" value={oktId} />
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter}
        type="submit"
      >
        {venter ? venterTekst : etikett}
      </button>
      {tilstand?.feil ? (
        <p className="mt-4" role="alert">
          {tilstand.feil}
        </p>
      ) : null}
    </form>
  );
}
