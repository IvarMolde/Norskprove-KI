"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { pastandSvarSchema } from "@/lib/oppgaver/lesing";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();

export async function startLytteokt(): Promise<{ feil: string } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_lytteokt");

    if (error) {
      console.error("startLytteokt", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    const id = uuidSchema.safeParse(data);
    if (!id.success) {
      return { feil: oktFeilTekst(undefined) };
    }

    redirect(`/ov/lytting/${id.data}`);
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("startLytteokt", error);
    return { feil: oktFeilTekst(undefined) };
  }
}

export async function lagreLytteSvar(
  oktId: string,
  oppgaveId: string,
  svar: unknown,
  besvart: boolean,
): Promise<{ feil: string } | null> {
  try {
    const okt = uuidSchema.safeParse(oktId);
    const oppgave = uuidSchema.safeParse(oppgaveId);
    const parsed = pastandSvarSchema.safeParse(svar);

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
      console.error("lagreLytteSvar", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    if (besvart) {
      redirect(`/ov/lytting/${okt.data}?gjennomgang=${oppgave.data}`);
    }

    return null;
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("lagreLytteSvar", error);
    return { feil: oktFeilTekst(undefined) };
  }
}

export async function fullforLytteokt(
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
      console.error("fullforLytteokt", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    redirect(`/ov/lytting/${okt.data}`);
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("fullforLytteokt", error);
    return { feil: oktFeilTekst(undefined) };
  }
}
