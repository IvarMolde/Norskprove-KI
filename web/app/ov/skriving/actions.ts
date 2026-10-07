"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hentSkriveokt } from "@/lib/okt/skriving";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { vurderTekst } from "@/lib/vurdering/modell";
import { fyllPrompt, systemprompt } from "@/lib/vurdering/prompt";

const uuidSchema = z.string().uuid();
const tekstSchema = z.string().trim().min(1).max(4000);

export async function startSkriveokt(): Promise<{ feil: string } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_skriveokt");

    if (error) {
      console.error("startSkriveokt", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    const id = uuidSchema.safeParse(data);
    if (!id.success) {
      return { feil: oktFeilTekst(undefined) };
    }

    redirect(`/ov/skriving/${id.data}`);
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("startSkriveokt", error);
    return { feil: oktFeilTekst(undefined) };
  }
}

export async function sendSkrivesvar(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  try {
    const okt = uuidSchema.safeParse(formData.get("oktId"));
    const oppgave = uuidSchema.safeParse(formData.get("oppgaveId"));
    const tekst = tekstSchema.safeParse(formData.get("tekst"));

    if (!okt.success || !oppgave.success || !tekst.success) {
      return { feil: oktFeilTekst("ugyldig_svar") };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { feil: oktFeilTekst("ikke_innlogget") };
    }

    const hentet = await hentSkriveokt(okt.data);
    if (!hentet.ok) {
      return { feil: hentet.feil };
    }

    if (hentet.data.status !== "pagaende") {
      return { feil: oktFeilTekst("okt_ikke_aktiv") };
    }

    if (hentet.data.oppgave.id !== oppgave.data) {
      return { feil: oktFeilTekst("oppgave_ikke_i_okt") };
    }

    const fylt = fyllPrompt(systemprompt(), {
      NIVAGRUPPE: hentet.data.oppgave.nivagruppe,
      OPPGAVETYPE: hentet.data.oppgave.oppgavetype,
      OPPGAVETEKST: hentet.data.oppgave.tekst,
      MIN_ORDANTALL: String(hentet.data.oppgave.min_ord),
      ELEVSVAR: tekst.data,
    });

    const vurdering = await vurderTekst(fylt);
    const admin = createAdminClient();
    if (!admin) {
      console.error("sendSkrivesvar mangler_tjenestenokkel");
      return { feil: oktFeilTekst("vurdering_utilgjengelig") };
    }

    const { error } = await admin.rpc("lagre_skriftlig_vurdering", {
      p_bruker_id: user.id,
      p_okt_id: okt.data,
      p_oppgave_id: oppgave.data,
      p_svar_tekst: tekst.data,
      p_vurdering: vurdering,
    });

    if (error) {
      console.error("sendSkrivesvar", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    redirect(`/ov/skriving/${okt.data}`);
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    if (
      error instanceof Error &&
      (error.message === "vurdering_feilet" ||
        error.message === "vurdering_utilgjengelig")
    ) {
      return { feil: oktFeilTekst(error.message) };
    }
    console.error("sendSkrivesvar", error);
    return { feil: oktFeilTekst(undefined) };
  }
}
