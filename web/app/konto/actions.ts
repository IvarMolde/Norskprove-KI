"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { slettOpptakForBruker } from "@/lib/personvern/slett-lyd";
import { createClient } from "@/lib/supabase/server";

const bekreftSkjema = z.object({
  bekreft: z.literal("ja"),
});

export async function slettKonto(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const sjekk = bekreftSkjema.safeParse({
      bekreft: formData.get("bekreft"),
    });
    if (!sjekk.success) {
      return { feil: "Huk av at du vil slette kontoen." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { feil: oktFeilTekst("ikke_innlogget") };
    }

    await slettOpptakForBruker(user.id);

    const slettet = await supabase.rpc("slett_egen_konto");
    if (slettet.error) {
      console.error("slettKonto", slettet.error.code);
      return { feil: oktFeilTekst(slettet.error.message) };
    }

    await supabase.auth.signOut();
    redirect("/?slettet=1");
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("slettKonto", error);
    return { feil: oktFeilTekst("konto_ikke_slettet") };
  }
}
