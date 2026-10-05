"use server";

import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();
const tekstSchema = z.string().max(4000);

export async function lagreTekstkladd(
  oktId: string,
  oppgaveId: string,
  tekst: string,
): Promise<{ feil: string } | null> {
  try {
    const okt = uuidSchema.safeParse(oktId);
    const oppgave = uuidSchema.safeParse(oppgaveId);
    const verdi = tekstSchema.safeParse(tekst);

    if (!okt.success || !oppgave.success || !verdi.success) {
      return { feil: oktFeilTekst("ugyldig_svar") };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("lagre_tekstkladd", {
      p_okt_id: okt.data,
      p_oppgave_id: oppgave.data,
      p_tekst: verdi.data,
    });

    if (error) {
      console.error("lagreTekstkladd", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    return null;
  } catch (error) {
    console.error("lagreTekstkladd", error);
    return { feil: oktFeilTekst(undefined) };
  }
}
