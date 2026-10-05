"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hentMuntligOkt } from "@/lib/okt/muntlig";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { slettGammelLyd } from "@/lib/personvern/slett-lyd";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { vurderMuntlig } from "@/lib/vurdering/muntlig";
import { fyllMuntligPrompt, muntligSystemprompt } from "@/lib/vurdering/muntlig-prompt";

const uuidSchema = z.string().uuid();
const tekstSchema = z.string().trim().min(1).max(4000);
const maksLyd = 8_000_000;

const lydTyper = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "video/webm",
]);

function lydEndelse(fil: File): "webm" | "wav" | "mp3" | "ogg" | null {
  const navn = fil.name.toLowerCase();
  if (navn.endsWith(".wav")) return "wav";
  if (navn.endsWith(".mp3")) return "mp3";
  if (navn.endsWith(".ogg")) return "ogg";
  if (navn.endsWith(".webm")) return "webm";
  if (fil.type === "audio/wav" || fil.type === "audio/wave" || fil.type === "audio/x-wav") {
    return "wav";
  }
  if (fil.type === "audio/mpeg" || fil.type === "audio/mp3") return "mp3";
  if (fil.type === "audio/ogg") return "ogg";
  if (fil.type === "audio/webm" || fil.type === "video/webm" || fil.type === "audio/mp4") {
    return "webm";
  }
  return null;
}

export async function startMuntligOkt(): Promise<{ feil: string } | null> {
  try {
    await slettGammelLyd();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_muntlig_okt");

    if (error) {
      console.error("startMuntligOkt", error.code);
      return { feil: oktFeilTekst(error.message) };
    }

    const id = uuidSchema.safeParse(data);
    if (!id.success) {
      return { feil: oktFeilTekst(undefined) };
    }

    redirect(`/ov/muntlig/${id.data}`);
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    console.error("startMuntligOkt", error);
    return { feil: oktFeilTekst(undefined) };
  }
}

export async function sendMuntligSvar(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  let objekt: string | null = null;
  const admin = createAdminClient();

  try {
    const okt = uuidSchema.safeParse(formData.get("oktId"));
    const oppgave = uuidSchema.safeParse(formData.get("oppgaveId"));
    const tekst = tekstSchema.safeParse(formData.get("tekst"));
    const lyd = formData.get("lyd");

    if (!okt.success || !oppgave.success) {
      return { feil: oktFeilTekst("ugyldig_svar") };
    }

    if (!tekst.success) {
      return { feil: oktFeilTekst("transkripsjon_mangler") };
    }

    if (!(lyd instanceof File) || lyd.size < 1) {
      return { feil: oktFeilTekst("mangler_lyd") };
    }

    const endelse = lydEndelse(lyd);
    const grunnType = lyd.type.split(";")[0]?.trim() ?? "";
    const kjentType =
      grunnType.length === 0 ||
      grunnType === "application/octet-stream" ||
      lydTyper.has(grunnType);
    if (lyd.size > maksLyd || !endelse || !kjentType) {
      return { feil: oktFeilTekst("ugyldig_svar") };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { feil: oktFeilTekst("ikke_innlogget") };
    }

    const hentet = await hentMuntligOkt(okt.data);
    if (!hentet.ok) {
      return { feil: hentet.feil };
    }

    if (hentet.data.status !== "pagaende") {
      return { feil: oktFeilTekst("okt_ikke_aktiv") };
    }

    if (hentet.data.oppgave.id !== oppgave.data) {
      return { feil: oktFeilTekst("oppgave_ikke_i_okt") };
    }

    if (!admin) {
      console.error("sendMuntligSvar mangler_tjenestenokkel");
      return { feil: oktFeilTekst("vurdering_utilgjengelig") };
    }

    const filId = crypto.randomUUID();
    objekt = `${user.id}/${filId}.${endelse}`;
    const bytes = new Uint8Array(await lyd.arrayBuffer());
    const lastet = await admin.storage.from("muntlig-opptak").upload(objekt, bytes, {
      contentType: lyd.type || "application/octet-stream",
      upsert: false,
    });

    if (lastet.error) {
      console.error("sendMuntligSvar opplasting", lastet.error.message);
      objekt = null;
      return { feil: oktFeilTekst("vurdering_utilgjengelig") };
    }

    const fylt = fyllMuntligPrompt(muntligSystemprompt(), {
      NIVAGRUPPE: hentet.data.oppgave.nivagruppe,
      OPPGAVETYPE: hentet.data.oppgave.oppgavetype,
      OPPGAVETEKST: hentet.data.oppgave.tekst,
      TRANSKRIPSJON: tekst.data,
    });

    const vurdering = await vurderMuntlig(fylt);
    const { error } = await admin.rpc("lagre_muntlig_vurdering", {
      p_bruker_id: user.id,
      p_okt_id: okt.data,
      p_oppgave_id: oppgave.data,
      p_svar_tekst: tekst.data,
      p_svar_lyd_url: `muntlig-opptak/${objekt}`,
      p_vurdering: vurdering,
    });

    if (error) {
      console.error("sendMuntligSvar", error.code);
      await admin.storage.from("muntlig-opptak").remove([objekt]);
      objekt = null;
      return { feil: oktFeilTekst(error.message) };
    }

    objekt = null;
    redirect(`/ov/muntlig/${okt.data}`);
  } catch (error) {
    if (admin && objekt) {
      try {
        await admin.storage.from("muntlig-opptak").remove([objekt]);
      } catch (slettFeil) {
        console.error("sendMuntligSvar rydd", slettFeil);
      }
    }
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
    console.error("sendMuntligSvar", error);
    return { feil: oktFeilTekst(undefined) };
  }
}
