"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();
const malSchema = z.enum(["muntlig", "adaptiv", "lytting", "skriving"]);
type Mal = z.infer<typeof malSchema>;

function liste(mal: Mal): string {
  if (mal === "muntlig") return "/ov/muntlig";
  if (mal === "lytting") return "/ov/lytting";
  if (mal === "skriving") return "/ov/skriving";
  return "/prove/adaptiv";
}

function oktSti(mal: Mal, id: string): string {
  if (mal === "muntlig") return `/ov/muntlig/${id}`;
  if (mal === "lytting") return `/ov/lytting/${id}`;
  if (mal === "skriving") return `/ov/skriving/${id}`;
  return `/prove/adaptiv/${id}`;
}

export async function pauseOkt(
  mal: Mal,
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const valgt = malSchema.safeParse(mal);
    const okt = uuidSchema.safeParse(formData.get("oktId"));
    if (!valgt.success || !okt.success) {
      return { feil: oktFeilTekst("okt_ikke_funnet") };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("pause_okt", { p_okt_id: okt.data });
    if (error) {
      console.error("pauseOkt", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    redirect(liste(valgt.data));
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("pauseOkt", error);
    return { feil: oktFeilTekst(undefined) };
  }
}

export async function gjenopptaOkt(
  mal: Mal,
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const valgt = malSchema.safeParse(mal);
    const okt = uuidSchema.safeParse(formData.get("oktId"));
    if (!valgt.success || !okt.success) {
      return { feil: oktFeilTekst("okt_ikke_funnet") };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("gjenoppta_okt", {
      p_okt_id: okt.data,
    });
    if (error) {
      console.error("gjenopptaOkt", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    const id = uuidSchema.safeParse(data);
    if (!id.success) {
      return { feil: oktFeilTekst(undefined) };
    }

    redirect(oktSti(valgt.data, id.data));
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("gjenopptaOkt", error);
    return { feil: oktFeilTekst(undefined) };
  }
}
