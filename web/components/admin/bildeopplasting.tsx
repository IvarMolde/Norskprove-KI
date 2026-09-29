"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function Bildeopplasting() {
  const router = useRouter();
  const [laster, setLaster] = useState(false);
  const [melding, setMelding] = useState("");
  const [ok, setOk] = useState(false);

  async function lastOpp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLaster(true);
    setMelding("");
    setOk(false);

    try {
      const skjema = event.currentTarget;
      const svar = await fetch("/api/admin/bilder", {
        method: "POST",
        body: new FormData(skjema),
      });
      const resultat: unknown = await svar.json();
      const tekst =
        typeof resultat === "object" &&
        resultat !== null &&
        "melding" in resultat &&
        typeof resultat.melding === "string"
          ? resultat.melding
          : "Uventet svar fra serveren.";
      setMelding(tekst);
      setOk(svar.ok);
      if (svar.ok) {
        skjema.reset();
        router.refresh();
      }
    } catch {
      setMelding("Bildet kunne ikke lastes opp. Prøv igjen.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <form className="admin-form upload-form" onSubmit={lastOpp}>
      <div className="form-grid">
        <label>
          Bildefil
          <input
            accept="image/jpeg,image/png,image/webp"
            name="fil"
            required
            type="file"
          />
          <small>JPG, PNG eller WebP. Maks 10 MB.</small>
        </label>
        <label>
          Beskrivelse / alt-tekst
          <input maxLength={500} minLength={3} name="beskrivelse" required />
        </label>
        <label>
          Tema
          <input maxLength={500} name="tema" />
        </label>
        <label>
          Fotograf
          <input maxLength={500} name="fotograf_navn" />
        </label>
        <label>
          Kildeplattform
          <input maxLength={500} name="kilde_plattform" />
        </label>
        <label>
          Kildelenke
          <input maxLength={2000} name="kilde_url" type="url" />
        </label>
        <label>
          Lisens
          <input maxLength={500} name="lisens" />
        </label>
        <label className="checkbox-label">
          <input name="kreditering_pakrevd" type="checkbox" value="true" />
          Kreditering er påkrevd
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-button" disabled={laster} type="submit">
          {laster ? "Laster opp …" : "Last opp bilde"}
        </button>
        {melding && (
          <p className={ok ? "success-message" : "error-message"}>{melding}</p>
        )}
      </div>
    </form>
  );
}
