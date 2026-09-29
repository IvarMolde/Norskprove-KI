"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LYDFORMATER = ["audio/webm", "audio/mp4", "audio/ogg"];

export function Opptaksstudio() {
  const router = useRouter();
  const opptaker = useRef<MediaRecorder | null>(null);
  const strøm = useRef<MediaStream | null>(null);
  const biter = useRef<Blob[]>([]);
  const [tarOpp, setTarOpp] = useState(false);
  const [opptak, setOpptak] = useState<Blob | null>(null);
  const [lydUrl, setLydUrl] = useState("");
  const [laster, setLaster] = useState(false);
  const [melding, setMelding] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    return () => {
      strøm.current?.getTracks().forEach((spor) => spor.stop());
      if (lydUrl) URL.revokeObjectURL(lydUrl);
    };
  }, [lydUrl]);

  async function startOpptak() {
    setMelding("");
    try {
      const mediestrøm = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mimeType =
        LYDFORMATER.find((format) => MediaRecorder.isTypeSupported(format)) ??
        "";
      const mediaRecorder = new MediaRecorder(
        mediestrøm,
        mimeType ? { mimeType } : undefined,
      );
      strøm.current = mediestrøm;
      opptaker.current = mediaRecorder;
      biter.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) biter.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const normalisertType = mimeType || "audio/webm";
        const blob = new Blob(biter.current, { type: normalisertType });
        if (lydUrl) URL.revokeObjectURL(lydUrl);
        setOpptak(blob);
        setLydUrl(URL.createObjectURL(blob));
        mediestrøm.getTracks().forEach((spor) => spor.stop());
      };
      mediaRecorder.start();
      setTarOpp(true);
    } catch {
      setMelding("Mikrofonen kunne ikke åpnes. Kontroller nettlesertillatelsen.");
    }
  }

  function stoppOpptak() {
    if (opptaker.current?.state === "recording") {
      opptaker.current.stop();
      setTarOpp(false);
    }
  }

  async function lagre(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLaster(true);
    setMelding("");
    setOk(false);

    try {
      const skjema = event.currentTarget;
      const formData = new FormData(skjema);
      const opplastet = formData.get("opplastet_fil");
      const fil =
        opptak ??
        (opplastet instanceof File && opplastet.size > 0 ? opplastet : null);
      if (!fil) {
        setMelding("Ta opp lyd eller velg en lydfil først.");
        return;
      }

      formData.delete("opplastet_fil");
      formData.set("fil", fil, `opptak.${fil.type.split("/")[1] ?? "webm"}`);
      formData.set("kilde", opptak ? "opptak" : "opplastet");

      const svar = await fetch("/api/admin/lyd", {
        method: "POST",
        body: formData,
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
        setOpptak(null);
        setLydUrl("");
        router.refresh();
      }
    } catch {
      setMelding("Lydfilen kunne ikke lagres. Prøv igjen.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <form className="admin-form studio-form" onSubmit={lagre}>
      <div className="recorder-panel">
        <div aria-live="polite" className={tarOpp ? "recording-dot active" : "recording-dot"}>
          {tarOpp ? "Opptak pågår" : "Klar for opptak"}
        </div>
        <div className="inline-actions">
          <button
            className="primary-button"
            disabled={tarOpp}
            onClick={startOpptak}
            type="button"
          >
            Start opptak
          </button>
          <button
            className="secondary-button"
            disabled={!tarOpp}
            onClick={stoppOpptak}
            type="button"
          >
            Stopp
          </button>
        </div>
        {lydUrl && <audio controls src={lydUrl} />}
      </div>

      <p className="divider-label">eller last opp en eksisterende fil</p>
      <label>
        Lydfil
        <input
          accept="audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav"
          disabled={Boolean(opptak)}
          name="opplastet_fil"
          type="file"
        />
        <small>Maks 25 MB.</small>
      </label>
      <label>
        Navn
        <input maxLength={150} minLength={2} name="navn" required />
      </label>
      <label>
        Transkripsjon
        <textarea maxLength={10000} name="transkripsjon" rows={6} />
        <small>Synlig tekstalternativ for WCAG.</small>
      </label>
      <div className="form-actions">
        <button className="primary-button" disabled={laster || tarOpp} type="submit">
          {laster ? "Lagrer …" : "Lagre lydfil"}
        </button>
        {melding && (
          <p className={ok ? "success-message" : "error-message"}>{melding}</p>
        )}
      </div>
    </form>
  );
}
