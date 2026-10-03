"use client";

import { useState, useTransition } from "react";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { lagreSvar } from "./actions";

export function useOppgaveLagring(oktId: string, oppgaveId: string) {
  const [feil, setFeil] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lagrer, startLagring] = useTransition();
  const [sender, startSending] = useTransition();

  function lagre(svar: unknown, besvart: boolean) {
    setFeil(null);

    if (besvart) {
      startSending(async () => {
        try {
          const resultat = await lagreSvar(oktId, oppgaveId, svar, true);
          if (resultat?.feil) {
            setFeil(resultat.feil);
            setStatus(null);
          }
        } catch (error) {
          if (erOmdirigering(error)) {
            return;
          }
          setFeil("Noe gikk galt. Prøv igjen.");
          setStatus(null);
        }
      });
      return;
    }

    setStatus("Lagrer…");
    startLagring(async () => {
      try {
        const resultat = await lagreSvar(oktId, oppgaveId, svar, false);
        if (resultat?.feil) {
          setFeil(resultat.feil);
          setStatus(null);
          return;
        }
        setStatus("Lagret");
      } catch (error) {
        if (erOmdirigering(error)) {
          return;
        }
        setFeil("Noe gikk galt. Prøv igjen.");
        setStatus(null);
      }
    });
  }

  return { feil, status, lagrer, sender, lagre };
}
