"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { createClient } from "@/lib/supabase/server";

const ferdighetSchema = z.enum(["lesing", "lytting"]);

export async function startAdaptivProve(
  ferdighet: "lesing" | "lytting",
): Promise<{ feil: string } | null> {
  try {
    const valgt = ferdighetSchema.safeParse(ferdighet);
    if (!valgt.success) {
      return { feil: oktFeilTekst("ugyldig_ferdighet") };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_adaptiv_prove", {
      p_ferdighet: valgt.data,
    });

    if (error) {
      console.error("startAdaptivProve", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    const id = z.string().uuid().safeParse(data);
    if (!id.success) {
      return { feil: oktFeilTekst(undefined) };
    }

    redirect(`/prove/adaptiv/${id.data}`);
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("startAdaptivProve", error);
    return { feil: oktFeilTekst(undefined) };
  }
}
