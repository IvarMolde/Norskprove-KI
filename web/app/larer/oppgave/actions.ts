"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { erOmdirigering } from "@/lib/okt/omdirigering";
import { rensSvg } from "@/lib/oppgaver/svg";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const maksBilde = 2_000_000;

const skjema = z.object({
  id: z.string().uuid().optional(),
  tittel: z.string().trim().min(1).max(120),
  tekst: z.string().trim().min(1).max(1000),
  oppgavetype: z.enum(["individuell_fortelle", "individuell_beskrive_bilde"]),
  nivagruppe: z.enum(["A1-A2", "A2-B1", "B1-B2"]),
  tema: z.string().trim().max(40),
  status: z.enum(["kladd", "publisert"]),
  beskrivelse: z.string().trim().max(300),
});

type BildeFil = {
  endelse: "png" | "webp" | "svg" | "pdf";
  bytes: Uint8Array;
};

function innholdstype(endelse: BildeFil["endelse"]): string {
  if (endelse === "png") return "image/png";
  if (endelse === "webp") return "image/webp";
  if (endelse === "svg") return "image/svg+xml";
  return "application/pdf";
}

function lesBilde(bytes: Uint8Array): BildeFil | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { endelse: "png", bytes };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { endelse: "webp", bytes };
  }

  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return { endelse: "pdf", bytes };
  }

  const svg = rensSvg(bytes);
  if (!svg || svg.byteLength > bytes.byteLength + 256) {
    return null;
  }
  return { endelse: "svg", bytes: svg };
}

export async function lagreLarerOppgave(
  _forrige: { feil: string } | null,
  formData: FormData,
): Promise<{ feil: string } | null> {
  let objekt: string | null = null;
  const admin = createAdminClient();

  try {
    const idFelt = formData.get("id");
    const parsed = skjema.safeParse({
      id: typeof idFelt === "string" && idFelt.length > 0 ? idFelt : undefined,
      tittel: formData.get("tittel"),
      tekst: formData.get("tekst"),
      oppgavetype: formData.get("oppgavetype"),
      nivagruppe: formData.get("nivagruppe"),
      tema: formData.get("tema") ?? "",
      status: formData.get("status"),
      beskrivelse: formData.get("beskrivelse") ?? "",
    });

    if (!parsed.success) {
      return { feil: oktFeilTekst("ugyldig_innhold") };
    }

    const supabase = await createClient();
    const fil = formData.get("bilde");
    let bildeId: string | null = null;
    const skalHaBilde = parsed.data.oppgavetype === "individuell_beskrive_bilde";

    if (skalHaBilde && parsed.data.beskrivelse.length < 1) {
      return { feil: oktFeilTekst("bilde_pakrevd") };
    }

    if (skalHaBilde && fil instanceof File && fil.size > 0) {
      if (!admin) {
        console.error("lagreLarerOppgave mangler_tjenestenokkel");
        return { feil: oktFeilTekst("bilde_utilgjengelig") };
      }

      if (fil.size > maksBilde) {
        return { feil: oktFeilTekst("ugyldig_bilde") };
      }

      const bytes = new Uint8Array(await fil.arrayBuffer());
      const bilde = lesBilde(bytes);
      if (!bilde || bilde.bytes.byteLength > maksBilde) {
        return { feil: oktFeilTekst("ugyldig_bilde") };
      }

      bildeId = randomUUID();
      objekt = `${bildeId}.${bilde.endelse}`;
      const lastet = await admin.storage.from("oppgave-bilder").upload(objekt, bilde.bytes, {
        contentType: innholdstype(bilde.endelse),
        upsert: false,
      });
      if (lastet.error) {
        console.error("lagreLarerOppgave opplasting");
        objekt = null;
        return { feil: oktFeilTekst("bilde_utilgjengelig") };
      }

      const lagretBilde = await supabase.rpc("larer_lagre_bilde", {
        p_id: bildeId,
        p_beskrivelse: parsed.data.beskrivelse,
        p_endelse: bilde.endelse,
      });
      if (lagretBilde.error) {
        console.error("lagreLarerOppgave bilde", lagretBilde.error.code);
        await admin.storage.from("oppgave-bilder").remove([objekt]);
        objekt = null;
        return { feil: oktFeilTekst(lagretBilde.error.message) };
      }
    } else if (skalHaBilde && parsed.data.id) {
      const eksisterende = z.string().uuid().safeParse(formData.get("bildeId"));
      if (!eksisterende.success) {
        return { feil: oktFeilTekst("bilde_pakrevd") };
      }
      bildeId = eksisterende.data;
    } else if (skalHaBilde) {
      return { feil: oktFeilTekst("bilde_pakrevd") };
    }

    const lagret = await supabase.rpc("larer_lagre_oppgave", {
      p_id: parsed.data.id ?? null,
      p_tittel: parsed.data.tittel,
      p_tekst: parsed.data.tekst,
      p_oppgavetype: parsed.data.oppgavetype,
      p_nivagruppe: parsed.data.nivagruppe,
      p_tema: parsed.data.tema,
      p_status: parsed.data.status,
      p_bilde_id: bildeId,
      p_beskrivelse: skalHaBilde ? parsed.data.beskrivelse : "",
    });

    if (lagret.error) {
      console.error("lagreLarerOppgave", lagret.error.code);
      if (admin && objekt && bildeId) {
        await supabase.rpc("larer_fjern_ubrukt_bilde", { p_id: bildeId });
        await admin.storage.from("oppgave-bilder").remove([objekt]);
      }
      return { feil: oktFeilTekst(lagret.error.message) };
    }

    objekt = null;
    redirect("/larer/oppgave?lagret=1");
  } catch (error) {
    if (erOmdirigering(error)) {
      throw error;
    }
    if (admin && objekt) {
      try {
        await admin.storage.from("oppgave-bilder").remove([objekt]);
      } catch (slettFeil) {
        console.error("lagreLarerOppgave opprydding", slettFeil);
      }
    }
    console.error("lagreLarerOppgave", error);
    return { feil: oktFeilTekst(undefined) };
  }
}
