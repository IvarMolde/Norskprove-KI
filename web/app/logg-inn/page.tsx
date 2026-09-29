"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoggInn() {
  const router = useRouter();
  const [epost, setEpost] = useState("");
  const [passord, setPassord] = useState("");
  const [melding, setMelding] = useState("");

  async function registrer() {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: epost,
        password: passord,
      });
      setMelding(
        error
          ? "Registreringen mislyktes. Kontroller opplysningene."
          : "Registrert! Du er nå innlogget.",
      );
    } catch {
      setMelding("Noe gikk galt. Prøv igjen.");
    }
  }

  async function loggInn() {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: epost,
        password: passord,
      });
      if (error) {
        setMelding("Innloggingen mislyktes. Kontroller e-post og passord.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setMelding("Noe gikk galt. Prøv igjen.");
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "320px" }}>
      <h1>Logg inn / Registrer</h1>
      <label htmlFor="epost">E-post</label>
      <input
        id="epost"
        type="email"
        placeholder="E-post"
        value={epost}
        onChange={(e) => setEpost(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: "0.5rem" }}
      />
      <label htmlFor="passord">Passord</label>
      <input
        id="passord"
        type="password"
        placeholder="Passord"
        value={passord}
        onChange={(e) => setPassord(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: "0.5rem" }}
      />
      <button onClick={registrer} style={{ marginRight: "0.5rem" }}>
        Registrer
      </button>
      <button onClick={loggInn}>Logg inn</button>
      {melding && <p>{melding}</p>}
    </div>
  );
}
