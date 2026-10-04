"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { nivaer } from "@/lib/personvern/mine-data";
import { createClient } from "@/lib/supabase/server";

const nivaSkjema = z.object({
  niva: z.enum(nivaer),
});

export async function lagreNiva(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const sjekk = nivaSkjema.safeParse({
      niva: formData.get("niva"),
    });
    if (!sjekk.success) {
      return { feil: oktFeilTekst("ugyldig_niva") };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { feil: oktFeilTekst("ikke_innlogget") };
    }

    const lagret = await supabase.rpc("sett_valgt_niva", {
      p_niva: sjekk.data.niva,
    });

    if (lagret.error) {
      console.error("lagreNiva", lagret.error.code);
      return { feil: oktFeilTekst(lagret.error.message) };
    }

    redirect("/mine-data?lagret=1");
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("lagreNiva", error);
    return { feil: oktFeilTekst(undefined) };
  }
}
