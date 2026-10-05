"use client";

import { useActionState, useState } from "react";
import type { LarerOppgave } from "@/lib/larer/oppgaver";
import { MuntligBilde } from "../../ov/muntlig/bilde";
import { lagreLarerOppgave } from "./actions";

export function OppgaveSkjema({ oppgave }: { oppgave: LarerOppgave | null }) {
  const [type, setType] = useState(
    oppgave?.oppgavetype ?? "individuell_fortelle",
  );
  const [tilstand, handling, venter] = useActionState(lagreLarerOppgave, null);
  const bilde = type === "individuell_beskrive_bilde";

  return (
    <form
      action={handling}
      className="flex flex-col gap-4"
      onReset={(event) => event.preventDefault()}
    >
      {oppgave ? <input name="id" type="hidden" value={oppgave.id} /> : null}
      {oppgave?.bilde ? (
        <input name="bildeId" type="hidden" value={oppgave.bilde.id} />
      ) : null}
      <label className="flex flex-col gap-2" htmlFor="oppgavetype">
        Type
        {oppgave ? (
          <>
            <input name="oppgavetype" type="hidden" value={oppgave.oppgavetype} />
            <span id="oppgavetype">
              {oppgave.oppgavetype === "individuell_beskrive_bilde"
                ? "Beskriv bilde"
                : "Fortelle"}
            </span>
          </>
        ) : (
          <select
            className="rounded border border-current p-2"
            id="oppgavetype"
            name="oppgavetype"
            onChange={(event) =>
              setType(
                event.target.value === "individuell_beskrive_bilde"
                  ? "individuell_beskrive_bilde"
                  : "individuell_fortelle",
              )
            }
            value={type}
          >
            <option value="individuell_fortelle">Fortelle</option>
            <option value="individuell_beskrive_bilde">Beskriv bilde</option>
          </select>
        )}
      </label>
      <label className="flex flex-col gap-2" htmlFor="tittel">
        Tittel
        <input
          className="rounded border border-current p-2"
          defaultValue={oppgave?.tittel ?? ""}
          id="tittel"
          maxLength={120}
          name="tittel"
          required
        />
      </label>
      <label className="flex flex-col gap-2" htmlFor="tekst">
        Oppgavetekst
        <textarea
          className="min-h-24 rounded border border-current p-2"
          defaultValue={oppgave?.tekst ?? ""}
          id="tekst"
          maxLength={1000}
          name="tekst"
          required
        />
      </label>
      <label className="flex flex-col gap-2" htmlFor="nivagruppe">
        Nivågruppe
        <select
          className="rounded border border-current p-2"
          defaultValue={oppgave?.nivagruppe ?? "A1-A2"}
          id="nivagruppe"
          name="nivagruppe"
        >
          <option value="A1-A2">A1-A2</option>
          <option value="A2-B1">A2-B1</option>
          <option value="B1-B2">B1-B2</option>
        </select>
      </label>
      <label className="flex flex-col gap-2" htmlFor="tema">
        Tema
        <input
          className="rounded border border-current p-2"
          defaultValue={oppgave?.tema ?? ""}
          id="tema"
          maxLength={40}
          name="tema"
        />
      </label>
      {bilde ? (
        <>
          {oppgave?.bilde ? (
            <MuntligBilde
              beskrivelse={oppgave.bilde.beskrivelse}
              url={oppgave.bilde.url}
            />
          ) : (
            <p>Bildet trengs når eleven skal beskrive det.</p>
          )}
          <label className="flex flex-col gap-2" htmlFor="beskrivelse">
            Hva er på bildet?
            <textarea
              className="min-h-20 rounded border border-current p-2"
              defaultValue={oppgave?.bilde?.beskrivelse ?? ""}
              id="beskrivelse"
              maxLength={300}
              name="beskrivelse"
              required
            />
          </label>
          <label className="flex flex-col gap-2" htmlFor="bilde">
            Bildefil
            <input
              accept="image/png,image/webp"
              id="bilde"
              name="bilde"
              required={!oppgave?.bilde}
              type="file"
            />
          </label>
        </>
      ) : null}
      <div className="flex gap-3">
        <button
          className="rounded border border-current px-4 py-2"
          disabled={venter}
          name="status"
          type="submit"
          value="kladd"
        >
          Lagre kladd
        </button>
        <button
          className="rounded border border-current px-4 py-2"
          disabled={venter}
          name="status"
          type="submit"
          value="publisert"
        >
          Publiser
        </button>
      </div>
      {tilstand?.feil ? <p role="alert">{tilstand.feil}</p> : null}
    </form>
  );
}
