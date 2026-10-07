"use client";

import { useActionState } from "react";
import {
  NIVA,
  type Niva,
  type SkjemaInnhold,
} from "@/lib/oppgaver/innhold";
import { arkiverOppgave, lagreOppgave } from "./actions";

const feltKlasse = "rounded border border-current px-3 py-2";

function TekstFelt({
  id,
  label,
  name,
  defaultValue,
  lang = false,
  required = true,
}: {
  id: string;
  label: string;
  name: string;
  defaultValue: string;
  lang?: boolean;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span>{label}</span>
      {lang ? (
        <textarea
          className={`${feltKlasse} min-h-24`}
          defaultValue={defaultValue}
          id={id}
          name={name}
          required={required}
        />
      ) : (
        <input
          autoComplete="off"
          className={feltKlasse}
          defaultValue={defaultValue}
          id={id}
          name={name}
          required={required}
          type="text"
        />
      )}
    </label>
  );
}

function JaNei({
  name,
  korrekt,
  legend,
}: {
  name: string;
  korrekt: boolean;
  legend: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend>{legend}</legend>
      <label className="flex items-center gap-2">
        <input
          defaultChecked={korrekt}
          name={name}
          required
          type="radio"
          value="ja"
        />
        Ja
      </label>
      <label className="flex items-center gap-2">
        <input defaultChecked={!korrekt} name={name} type="radio" value="nei" />
        Nei
      </label>
    </fieldset>
  );
}

export function ArkiverSkjema({ id }: { id: string }) {
  const [tilstand, handling, venter] = useActionState(arkiverOppgave, null);

  return (
    <form action={handling}>
      <input name="id" type="hidden" value={id} />
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter}
        type="submit"
      >
        {venter ? "Arkiverer…" : "Arkiver"}
      </button>
      {tilstand?.feil ? (
        <p className="mt-4" role="alert">
          {tilstand.feil}
        </p>
      ) : null}
    </form>
  );
}

export function OppgaveSkjema({
  id,
  niva,
  tema,
  innhold,
}: {
  id?: string;
  niva: Niva;
  tema: string;
  innhold: SkjemaInnhold;
}) {
  const [tilstand, handling, venter] = useActionState(lagreOppgave, null);

  return (
    <form action={handling} className="flex flex-col gap-4">
      {id ? <input name="id" type="hidden" value={id} /> : null}
      <input name="type" type="hidden" value={innhold.type} />
      <p>{hjelp(innhold.type)}</p>
      <label className="flex flex-col gap-1" htmlFor="niva">
        <span>Nivå</span>
        <select className={feltKlasse} defaultValue={niva} id="niva" name="niva">
          {NIVA.map((verdi) => (
            <option key={verdi} value={verdi}>
              {verdi}
            </option>
          ))}
        </select>
      </label>
      <TekstFelt
        defaultValue={tema}
        id="tema"
        label="Tema (kan stå tomt)"
        name="tema"
        required={false}
      />
      {innhold.type === "pastand_korrekt" ? (
        <PastandFelter innhold={innhold} />
      ) : null}
      {innhold.type === "fyll_inn" ? <FyllFelter innhold={innhold} /> : null}
      {innhold.type === "synonym" || innhold.type === "antonym" ? (
        <OrdvalgFelter innhold={innhold} />
      ) : null}
      {innhold.type === "rekkefolge" ? (
        <RekkefolgeFelter innhold={innhold} />
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded border border-current px-4 py-2"
          disabled={venter}
          name="maal"
          type="submit"
          value="kladd"
        >
          {venter ? "Lagrer…" : "Lagre kladd"}
        </button>
        <button
          className="rounded border border-current px-4 py-2"
          disabled={venter}
          name="maal"
          type="submit"
          value="publisert"
        >
          {venter ? "Lagrer…" : "Publiser"}
        </button>
      </div>
      {tilstand?.feil ? <p role="alert">{tilstand.feil}</p> : null}
    </form>
  );
}

function hjelp(type: SkjemaInnhold["type"]): string {
  if (type === "pastand_korrekt") {
    return "Skriv to påstander. Merk om de er riktige.";
  }
  if (type === "fyll_inn") {
    return "Skriv setningen med ett hull. Det riktige ordet skal ikke stå i teksten.";
  }
  if (type === "synonym") {
    return "Skriv ordet og tre alternativer. Merk det riktige.";
  }
  if (type === "antonym") {
    return "Skriv ordet og tre alternativer. Merk det motsatte.";
  }
  return "Skriv tre ledd i riktig rekkefølge.";
}

function PastandFelter({
  innhold,
}: {
  innhold: Extract<SkjemaInnhold, { type: "pastand_korrekt" }>;
}) {
  return (
    <>
      <TekstFelt defaultValue={innhold.tittel} id="tittel" label="Tittel" name="tittel" />
      <TekstFelt
        defaultValue={innhold.tekst}
        id="tekst"
        label="Tekst"
        lang
        name="tekst"
      />
      {innhold.pastander.map((pastand, index) => {
        const nummer = index + 1;
        return (
          <div className="flex flex-col gap-3" key={pastand.id}>
            <input name={`p${nummer}_id`} type="hidden" value={pastand.id} />
            <TekstFelt
              defaultValue={pastand.tekst}
              id={`p${nummer}_tekst`}
              label={`Påstand ${nummer}`}
              name={`p${nummer}_tekst`}
            />
            <JaNei
              korrekt={pastand.korrekt}
              legend={`Er påstand ${nummer} riktig?`}
              name={`p${nummer}_korrekt`}
            />
          </div>
        );
      })}
    </>
  );
}

function FyllFelter({
  innhold,
}: {
  innhold: Extract<SkjemaInnhold, { type: "fyll_inn" }>;
}) {
  return (
    <>
      <input name="hull_id" type="hidden" value={innhold.hullId} />
      <TekstFelt defaultValue={innhold.tittel} id="tittel" label="Tittel" name="tittel" />
      <TekstFelt
        defaultValue={innhold.tekst}
        id="tekst"
        label="Tekst"
        lang
        name="tekst"
      />
      <TekstFelt
        defaultValue={innhold.foran}
        id="foran"
        label="Tekst før hullet"
        name="foran"
      />
      <TekstFelt
        defaultValue={innhold.etter}
        id="etter"
        label="Tekst etter hullet"
        name="etter"
      />
      <TekstFelt
        defaultValue={innhold.ord}
        id="ord"
        label="Riktig ord"
        name="ord"
      />
    </>
  );
}

function OrdvalgFelter({
  innhold,
}: {
  innhold: Extract<SkjemaInnhold, { type: "synonym" | "antonym" }>;
}) {
  return (
    <>
      <TekstFelt defaultValue={innhold.tittel} id="tittel" label="Tittel" name="tittel" />
      <TekstFelt defaultValue={innhold.ord} id="ord" label="Ordet" name="ord" />
      <TekstFelt
        defaultValue={innhold.setning}
        id="setning"
        label="Setning"
        name="setning"
      />
      {innhold.alternativer.map((alt, index) => {
        const nummer = index + 1;
        return (
          <div key={alt.id}>
            <input name={`a${nummer}_id`} type="hidden" value={alt.id} />
            <TekstFelt
              defaultValue={alt.tekst}
              id={`a${nummer}_tekst`}
              label={`Alternativ ${nummer}`}
              name={`a${nummer}_tekst`}
            />
          </div>
        );
      })}
      <label className="flex flex-col gap-1" htmlFor="korrekt">
        <span>Riktig alternativ</span>
        <select
          className={feltKlasse}
          defaultValue={innhold.korrekt}
          id="korrekt"
          name="korrekt"
        >
          {innhold.alternativer.map((alt, index) => (
            <option key={alt.id} value={alt.id}>
              Alternativ {index + 1}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function RekkefolgeFelter({
  innhold,
}: {
  innhold: Extract<SkjemaInnhold, { type: "rekkefolge" }>;
}) {
  return (
    <>
      <TekstFelt defaultValue={innhold.tittel} id="tittel" label="Tittel" name="tittel" />
      {innhold.ledd.map((rad, index) => {
        const nummer = index + 1;
        return (
          <div key={rad.id}>
            <input name={`l${nummer}_id`} type="hidden" value={rad.id} />
            <TekstFelt
              defaultValue={rad.tekst}
              id={`l${nummer}_tekst`}
              label={`Ledd ${nummer}`}
              name={`l${nummer}_tekst`}
            />
          </div>
        );
      })}
      <p>Eleven ser leddene i omvendt rekkefølge.</p>
    </>
  );
}
