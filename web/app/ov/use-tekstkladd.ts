"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lagreTekstkladd } from "./kladd-actions";

export function useTekstkladd(oktId: string, oppgaveId: string, start: string) {
  const [tekst, setTekst] = useState(start);
  const [status, setStatus] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const sist = useRef(start.trim());
  const tekstRef = useRef(start);
  const versjon = useRef(0);
  const timer = useRef<number | null>(null);
  const tillatt = useRef(true);

  const stoppTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => stoppTimer, [stoppTimer]);

  const settAktiv = useCallback(
    (aktiv: boolean) => {
      tillatt.current = aktiv;
      if (!aktiv) {
        stoppTimer();
      }
    },
    [stoppTimer],
  );

  const send = useCallback(
    async (verdi: string) => {
      const nr = versjon.current + 1;
      versjon.current = nr;
      setStatus("Lagrer…");
      setFeil(null);

      try {
        const resultat = await lagreTekstkladd(oktId, oppgaveId, verdi);
        if (nr !== versjon.current) {
          return;
        }
        if (tekstRef.current.trim() !== verdi.trim()) {
          return;
        }
        if (resultat?.feil) {
          setFeil(resultat.feil);
          setStatus(null);
          return;
        }
        sist.current = verdi.trim();
        setStatus("Lagret");
      } catch {
        if (nr !== versjon.current) {
          return;
        }
        setFeil("Noe gikk galt. Prøv igjen.");
        setStatus(null);
      }
    },
    [oktId, oppgaveId],
  );

  const oppdater = useCallback(
    (neste: string) => {
      tekstRef.current = neste;
      setTekst(neste);
      if (!tillatt.current) {
        return;
      }
      stoppTimer();
      if (neste.trim() === sist.current) {
        return;
      }
      timer.current = window.setTimeout(() => {
        void send(neste);
      }, 500);
    },
    [send, stoppTimer],
  );

  return { tekst, oppdater, status, feil, settAktiv };
}
