"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { lagreSvarSchema } from "@/lib/oppgaver/lesing";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();

export async function startLeseokt(): Promise<{ feil: string } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_leseokt");

    if (error) {
      console.error("startLeseokt", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    const id = uuidSchema.safeParse(data);
    if (!id.success) {
      return { feil: oktFeilTekst(undefined) };
    }

    redirect(`/ov/lesing/${id.data}`);
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("startLeseokt", error);
    return { feil: oktFeilTekst(undefined) };
  }
}

export async function lagreSvar(
  oktId: string,
  oppgaveId: string,
  svar: unknown,
  besvart: boolean,
): Promise<{ feil: string } | null> {
  try {
    const okt = uuidSchema.safeParse(oktId);
    const oppgave = uuidSchema.safeParse(oppgaveId);
    const parsed = lagreSvarSchema.safeParse(svar);

    if (!okt.success || !oppgave.success || !parsed.success) {
      return { feil: oktFeilTekst("ugyldig_svar") };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("lagre_svar", {
      p_okt_id: okt.data,
      p_oppgave_id: oppgave.data,
      p_svar_tekst: JSON.stringify(parsed.data),
      p_besvart: besvart,
    });

    if (error) {
      console.error("lagreSvar", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    if (besvart) {
      redirect(`/ov/lesing/${okt.data}?gjennomgang=${oppgave.data}`);
    }

    return null;
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("lagreSvar", error);
    return { feil: oktFeilTekst(undefined) };
  }
}

export async function fullforOkt(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const okt = uuidSchema.safeParse(formData.get("oktId"));
    if (!okt.success) {
      return { feil: oktFeilTekst("okt_ikke_funnet") };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("fullfor_okt", {
      p_okt_id: okt.data,
    });

    if (error) {
      console.error("fullforOkt", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    redirect(`/ov/lesing/${okt.data}`);
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("fullforOkt", error);
    return { feil: oktFeilTekst(undefined) };
  }
}

