"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { innloggingFeilTekst } from "@/lib/auth/feil";
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

const epostSkjema = z.object({
  epost: z.string().trim().email(),
  passord: z.string().min(6),
});

export async function endreEpost(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const sjekk = epostSkjema.safeParse({
      epost: formData.get("epost"),
      passord: formData.get("passord"),
    });
    if (!sjekk.success) {
      return { feil: "Skriv en gyldig e-post og passordet ditt." };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return { feil: oktFeilTekst("ikke_innlogget") };
    }

    const ny = sjekk.data.epost.toLowerCase();
    if (ny === user.email.toLowerCase()) {
      return { feil: "Skriv en ny e-post." };
    }

    const innlogget = await supabase.auth.signInWithPassword({
      email: user.email,
      password: sjekk.data.passord,
    });
    if (innlogget.error) {
      console.error("endreEpost", innlogget.error.code);
      return { feil: innloggingFeilTekst(innlogget.error, "inn") };
    }

    const oppdatert = await supabase.auth.updateUser({ email: ny });
    if (oppdatert.error) {
      console.error("endreEpost", oppdatert.error.code);
      return { feil: innloggingFeilTekst(oppdatert.error, "endre") };
    }

    const venter = Boolean(oppdatert.data.user?.new_email);
    redirect(venter ? "/mine-data?epost=1" : "/mine-data?epost=2");
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("endreEpost", error);
    return { feil: "Vi fikk ikke endret e-posten. Prøv igjen." };
  }
}
