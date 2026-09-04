"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoggInn() {
  const [epost, setEpost] = useState("");
  const [passord, setPassord] = useState("");
  const [melding, setMelding] = useState("");
  const supabase = createClient();

  async function registrer() {
    const { error } = await supabase.auth.signUp({
      email: epost,
      password: passord,
    });
    setMelding(
      error ? `Feil: ${error.message}` : "Registrert! Du er nå innlogget.",
    );
  }

  async function loggInn() {
    const { error } = await supabase.auth.signInWithPassword({
      email: epost,
      password: passord,
    });
    setMelding(error ? `Feil: ${error.message}` : "Innlogget!");
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "320px" }}>
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
      <button onClick={registrer} style={{ marginRight: "0.5rem" }}>
        Registrer
      </button>
      <button onClick={loggInn}>Logg inn</button>
      {melding && <p>{melding}</p>}
    </div>
  );
}
