"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { createClient } from "@/lib/supabase/server";

const skjema = z.object({
  svarId: z.string().uuid(),
  niva: z.enum(["Under A1", "A1", "A2", "B1", "B2"]),
  kommentar: z.string().trim().min(1).max(1000),
});

export async function sendLarerKommentar(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const sjekk = skjema.safeParse({
      svarId: formData.get("svarId"),
      niva: formData.get("niva"),
      kommentar: formData.get("kommentar"),
    });

    if (!sjekk.success) {
      const niva = z.enum(["Under A1", "A1", "A2", "B1", "B2"]).safeParse(formData.get("niva"));
      if (!niva.success) {
        return { feil: oktFeilTekst("ugyldig_larerniva") };
      }
      return { feil: oktFeilTekst("kommentar_mangler") };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("lagre_larer_kommentar", {
      p_svar_id: sjekk.data.svarId,
      p_niva: sjekk.data.niva,
      p_kommentar: sjekk.data.kommentar,
    });

    if (error) {
      console.error("sendLarerKommentar", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    redirect(`/larer/${sjekk.data.svarId}?sendt=1`);
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("sendLarerKommentar", error);
    return { feil: oktFeilTekst(undefined) };
  }
}
