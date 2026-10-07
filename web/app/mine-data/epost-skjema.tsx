"use client";

import { useActionState } from "react";
import { endreEpost } from "./actions";

export function EpostSkjema() {
  const [tilstand, handling, venter] = useActionState(endreEpost, null);

  return (
    <form action={handling} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        Ny e-post
        <input
          autoComplete="email"
          className="rounded border border-current px-3 py-2"
          name="epost"
          required
          type="email"
        />
      </label>
      <label className="flex flex-col gap-1">
        Passord
        <input
          autoComplete="current-password"
          className="rounded border border-current px-3 py-2"
          name="passord"
          required
          type="password"
        />
      </label>
      <button
        className="w-fit rounded border border-current px-4 py-2 disabled:opacity-50"
        disabled={venter}
        type="submit"
      >
        {venter ? "Lagrer…" : "Endre e-post"}
      </button>
      {tilstand?.feil ? <p role="alert">{tilstand.feil}</p> : null}
    </form>
  );
}
