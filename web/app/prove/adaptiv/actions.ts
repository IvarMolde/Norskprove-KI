"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { createClient } from "@/lib/supabase/server";

export async function startAdaptivProve(): Promise<{ feil: string } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_adaptiv_prove");

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
