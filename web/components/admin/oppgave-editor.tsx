"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  FERDIGHETER,
  NIVAER,
  OPPGAVESTATUSER,
  OPPGAVETYPER,
  type BildeRad,
  type LydRad,
  type OppgaveRad,
} from "@/lib/admin/schemas";
import {
  lagreOppgave,
  type OppgaveSkjemaState,
} from "@/app/admin/oppgaver/actions";

type Props = {
  oppgaver: OppgaveRad[];
  bilder: BildeRad[];
  lydfiler: LydRad[];
};

const startState: OppgaveSkjemaState = { ok: false, melding: "" };

function Lagreknapp() {
  const { pending } = useFormStatus();
  return (
    <button className="primary-button" disabled={pending} type="submit">
      {pending ? "Lagrer …" : "Lagre oppgave"}
    </button>
  );
}

export function OppgaveEditor({ oppgaver, bilder, lydfiler }: Props) {
  const [state, action] = useActionState(lagreOppgave, startState);
  const [valgtId, setValgtId] = useState("");
  const valgt = oppgaver.find((oppgave) => oppgave.id === valgtId);

  return (
    <div className="editor-layout">
      <aside className="bank-list">
        <button
          className={!valgt ? "active" : ""}
          onClick={() => setValgtId("")}
          type="button"
        >
          + Ny oppgave
        </button>
        {oppgaver.map((oppgave) => (
          <button
            className={valgtId === oppgave.id ? "active" : ""}
            key={oppgave.id}
            onClick={() => setValgtId(oppgave.id)}
            type="button"
          >
            <strong>{oppgave.type.replaceAll("_", " ")}</strong>
            <span>
              {oppgave.nivå} · {oppgave.status}
            </span>
          </button>
        ))}
      </aside>

      <form
        action={action}
        className="admin-form"
        key={valgt?.id ?? "ny"}
      >
        <input name="id" type="hidden" value={valgt?.id ?? ""} />
        <div className="form-grid">
          <label>
            Oppgavetype
            <select defaultValue={valgt?.type ?? "fyll_inn"} name="type">
              {OPPGAVETYPER.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ferdighet
            <select defaultValue={valgt?.ferdighet ?? "lesing"} name="ferdighet">
              {FERDIGHETER.map((ferdighet) => (
                <option key={ferdighet} value={ferdighet}>
                  {ferdighet}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nivå
            <select defaultValue={valgt?.nivå ?? "A1"} name="nivå">
              {NIVAER.map((nivå) => (
                <option key={nivå}>{nivå}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select defaultValue={valgt?.status ?? "kladd"} name="status">
              {OPPGAVESTATUSER.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Tema
            <input
              defaultValue={valgt?.tema ?? ""}
              maxLength={500}
              name="tema"
              placeholder="For eksempel arbeid"
            />
          </label>
          <label>
            Kilde
            <select defaultValue={valgt?.kilde ?? "autentisk"} name="kilde">
              <option value="autentisk">Autentisk</option>
              <option value="ki_generert">KI-generert</option>
            </select>
          </label>
          <label>
            Bilde
            <select defaultValue={valgt?.bilde_id ?? ""} name="bilde_id">
              <option value="">Ingen</option>
              {bilder.map((bilde) => (
                <option key={bilde.id} value={bilde.id}>
                  {bilde.beskrivelse}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lydfil
            <select defaultValue={valgt?.lydfil_id ?? ""} name="lydfil_id">
              <option value="">Ingen</option>
              {lydfiler.map((lyd) => (
                <option key={lyd.id} value={lyd.id}>
                  {lyd.navn}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Type-spesifikt innhold (JSON)
          <textarea
            className="code-field"
            defaultValue={JSON.stringify(
              valgt?.innhold ?? {
                instruksjon: "",
                sporsmal: "",
                fasit: "",
              },
              null,
              2,
            )}
            name="innhold"
            required
            rows={14}
            spellCheck={false}
          />
        </label>

        <label className="checkbox-label">
          <input
            defaultChecked={valgt?.kvalitetssjekket ?? false}
            name="kvalitetssjekket"
            type="checkbox"
          />
          Kvalitetssjekket
        </label>

        <div className="form-actions">
          <Lagreknapp />
          {state.melding && (
            <p className={state.ok ? "success-message" : "error-message"}>
              {state.melding}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
