"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { innloggingFeilTekst } from "@/lib/auth/feil";
import { createClient } from "@/lib/supabase/client";

const registreringSkjema = z.object({
  epost: z.string().email(),
  passord: z.string().min(6),
  lestPersonvern: z.literal(true),
  erAtten: z.literal(true),
});

export default function LoggInn() {
  const [epost, setEpost] = useState("");
  const [passord, setPassord] = useState("");
  const [lestPersonvern, setLestPersonvern] = useState(false);
  const [erAtten, setErAtten] = useState(false);
  const [melding, setMelding] = useState("");
  const supabase = createClient();

  async function lagreAlder() {
    const { error } = await supabase.rpc("bekreft_alder");
    if (error) {
      setMelding("Vi fikk ikke lagret at du er 18 år. Prøv igjen.");
      return;
    }
    setMelding("Registrert! Du er nå innlogget.");
  }

  async function registrer() {
    const sjekk = registreringSkjema.safeParse({
      epost,
      passord,
      lestPersonvern,
      erAtten,
    });
    if (!sjekk.success) {
      setMelding(
        "Skriv en gyldig e-post og et passord på minst 6 tegn. Les personvernerklæringen og huk av at du er 18 år.",
      );
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: epost,
        password: passord,
      });
      if (error) {
        const { data: sesjon } = await supabase.auth.getSession();
        if (sesjon.session) {
          await lagreAlder();
          return;
        }
        setMelding(innloggingFeilTekst(error, "registrer"));
        return;
      }
      if (!data.session) {
        setMelding("Kontoen er opprettet. Logg inn for å fortsette.");
        return;
      }
      await lagreAlder();
    } catch {
      setMelding("Vi fikk ikke opprettet kontoen. Prøv igjen.");
    }
  }

  async function loggInn() {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: epost,
        password: passord,
      });
      setMelding(error ? innloggingFeilTekst(error, "inn") : "Innlogget!");
    } catch {
      setMelding("Vi fikk ikke logget deg inn. Prøv igjen.");
    }
  }

  const kanRegistrere = lestPersonvern && erAtten;

  return (
    <div style={{ padding: "2rem", maxWidth: "24rem" }}>
      <h1>Logg inn / Registrer</h1>
      <input
        type="email"
        placeholder="E-post"
        value={epost}
        onChange={(e) => setEpost(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: "0.5rem" }}
      />
      <input
        type="password"
        placeholder="Passord"
        value={passord}
        onChange={(e) => setPassord(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: "0.5rem" }}
      />
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        <input
          type="checkbox"
          checked={lestPersonvern}
          onChange={(e) => setLestPersonvern(e.target.checked)}
        />{" "}
        Jeg har lest{" "}
        <Link href="/personvern">personvernerklæringen</Link>
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        <input
          type="checkbox"
          checked={erAtten}
          onChange={(e) => setErAtten(e.target.checked)}
        />{" "}
        Jeg er 18 år
      </label>
      <button
        onClick={registrer}
        disabled={!kanRegistrere}
        style={{ marginRight: "0.5rem" }}
      >
        Registrer
      </button>
      <button onClick={loggInn}>Logg inn</button>
      {melding && <p>{melding}</p>}
      <p>
        <Link href="/ov/lesing">Øv på lesing</Link>
      </p>
      <p>
        <Link href="/">Hjem</Link>
      </p>
    </div>
  );
}
