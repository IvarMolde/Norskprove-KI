"use client";

import { useActionState, useRef, useState } from "react";
import { MuntligBilde } from "./bilde";
import { sendMuntligSvar } from "./actions";

type Talegjenkjenning = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function hentGjenkjenning(): Talegjenkjenning | null {
  if (typeof window === "undefined") {
    return null;
  }
  const vindu = window as Window & {
    SpeechRecognition?: new () => Talegjenkjenning;
    webkitSpeechRecognition?: new () => Talegjenkjenning;
  };
  const Konstruktør = vindu.SpeechRecognition ?? vindu.webkitSpeechRecognition;
  if (!Konstruktør) {
    return null;
  }
  const gjenkjenning = new Konstruktør();
  gjenkjenning.lang = "nb-NO";
  gjenkjenning.continuous = true;
  gjenkjenning.interimResults = false;
  return gjenkjenning;
}

export function MuntligSkjema({
  oktId,
  oppgaveId,
  tittel,
  tekst,
  bilde,
}: {
  oktId: string;
  oppgaveId: string;
  tittel: string;
  tekst: string;
  bilde: { url: string; beskrivelse: string } | null;
}) {
  const [tilstand, handling, venter] = useActionState(sendMuntligSvar, null);
  const [tarOpp, setTarOpp] = useState(false);
  const [harLyd, setHarLyd] = useState(false);
  const [tekstverdi, setTekstverdi] = useState("");
  const [mikrofonFeil, setMikrofonFeil] = useState<string | null>(null);
  const opptaker = useRef<MediaRecorder | null>(null);
  const gjenkjenning = useRef<Talegjenkjenning | null>(null);
  const lydfelt = useRef<HTMLInputElement | null>(null);
  const biter = useRef<Blob[]>([]);

  function stoppSpor() {
    const opptak = opptaker.current;
    opptaker.current = null;
    if (opptak && opptak.state !== "inactive") {
      opptak.stop();
    } else {
      opptak?.stream.getTracks().forEach((spor) => spor.stop());
    }
    try {
      gjenkjenning.current?.stop();
    } catch {
      // Gjenkjenningen kan allerede være stoppet.
    }
    gjenkjenning.current = null;
  }

  async function startOpptak() {
    setMikrofonFeil(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMikrofonFeil("Vi fikk ikke bruke mikrofonen. Velg en lydfil i stedet.");
      return;
    }

    try {
      const strom = await navigator.mediaDevices.getUserMedia({ audio: true });
      biter.current = [];
      const opptak = new MediaRecorder(strom);
      opptaker.current = opptak;
      opptak.ondataavailable = (hendelse) => {
        if (hendelse.data.size > 0) {
          biter.current.push(hendelse.data);
        }
      };
      opptak.onstop = () => {
        const blob = new Blob(biter.current, { type: opptak.mimeType || "audio/webm" });
        const fil = new File([blob], "svar.webm", { type: blob.type || "audio/webm" });
        const felt = lydfelt.current;
        if (felt) {
          const data = new DataTransfer();
          data.items.add(fil);
          felt.files = data.files;
        }
        strom.getTracks().forEach((spor) => spor.stop());
        setHarLyd(blob.size > 0);
      };

      const tale = hentGjenkjenning();
      if (tale) {
        tale.onresult = (event) => {
          const deler: string[] = [];
          for (let i = 0; i < event.results.length; i += 1) {
            deler.push(event.results[i][0]?.transcript ?? "");
          }
          const samlet = deler.join(" ").trim();
          if (samlet) {
            setTekstverdi(samlet);
          }
        };
        tale.onerror = () => {
          // Eleven kan skrive teksten selv.
        };
        try {
          tale.start();
          gjenkjenning.current = tale;
        } catch {
          gjenkjenning.current = null;
        }
      }

      opptak.start();
      setTarOpp(true);
      window.setTimeout(() => {
        if (opptaker.current === opptak && opptak.state === "recording") {
          stoppSpor();
          setTarOpp(false);
        }
      }, 180_000);
    } catch {
      setMikrofonFeil("Vi fikk ikke bruke mikrofonen. Velg en lydfil i stedet.");
    }
  }

  function stoppOpptak() {
    stoppSpor();
    setTarOpp(false);
  }

  return (
    <form action={handling} className="flex flex-col gap-4">
      <p>Oppgave 1 av 1</p>
      <h2 className="text-xl font-semibold">{tittel}</h2>
      {bilde ? <MuntligBilde beskrivelse={bilde.beskrivelse} url={bilde.url} /> : null}
      <p>{tekst}</p>
      <p>Vi lagrer lyden. Vurderingen leser teksten du sendte. Uttale og flyt er usikre.</p>
      <input name="oktId" type="hidden" value={oktId} />
      <input name="oppgaveId" type="hidden" value={oppgaveId} />
      <div className="flex gap-3">
        <button
          className="rounded border border-current px-4 py-2"
          disabled={venter || tarOpp}
          onClick={() => {
            void startOpptak();
          }}
          type="button"
        >
          Ta opp
        </button>
        <button
          className="rounded border border-current px-4 py-2"
          disabled={venter || !tarOpp}
          onClick={stoppOpptak}
          type="button"
        >
          Stopp
        </button>
      </div>
      {tarOpp ? <p>Tar opp…</p> : null}
      {mikrofonFeil ? <p role="alert">{mikrofonFeil}</p> : null}
      <label className="flex flex-col gap-2" htmlFor="lyd">
        Lydfil
        <input
          accept="audio/*,.webm,.wav,.mp3,.ogg"
          disabled={venter}
          id="lyd"
          name="lyd"
          onChange={() => setHarLyd((lydfelt.current?.files?.length ?? 0) > 0)}
          ref={lydfelt}
          required
          type="file"
        />
      </label>
      <label className="flex flex-col gap-2" htmlFor="tekst">
        Teksten du sa
        <textarea
          className="min-h-32 w-full rounded border border-current p-3"
          disabled={venter}
          id="tekst"
          maxLength={4000}
          name="tekst"
          onChange={(event) => setTekstverdi(event.target.value)}
          required
          rows={6}
          value={tekstverdi}
        />
      </label>
      <p>Rett teksten hvis noe er feil.</p>
      <button
        className="rounded border border-current px-4 py-2"
        disabled={venter || tarOpp || !harLyd}
        type="submit"
      >
        {venter ? "Vurderer…" : "Send inn"}
      </button>
      {tilstand?.feil ? <p role="alert">{tilstand.feil}</p> : null}
    </form>
  );
}
