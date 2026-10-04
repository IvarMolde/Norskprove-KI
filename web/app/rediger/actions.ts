"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { lesSkjema } from "@/lib/oppgaver/innhold";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { createClient } from "@/lib/supabase/server";

export async function lagreOppgave(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const skjema = lesSkjema(formData);
    if (!skjema.ok) {
      return { feil: oktFeilTekst("ugyldig_innhold") };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("redaktor_lagre", {
      p_id: skjema.data.id,
      p_type: skjema.data.type,
      p_niva: skjema.data.niva,
      p_tema: skjema.data.tema,
      p_innhold: skjema.data.innhold,
      p_status: skjema.data.status,
    });

    if (error) {
      console.error("lagreOppgave", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    redirect("/rediger");
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("lagreOppgave", error);
    return { feil: oktFeilTekst(undefined) };
  }
}

export async function arkiverOppgave(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const id = z.string().uuid().safeParse(formData.get("id"));
    if (!id.success) {
      return { feil: oktFeilTekst("oppgave_ikke_funnet") };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("redaktor_sett_status", {
      p_id: id.data,
      p_status: "arkivert",
    });

    if (error) {
      console.error("arkiverOppgave", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    redirect("/rediger");
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("arkiverOppgave", error);
    return { feil: oktFeilTekst(undefined) };
  }
}
