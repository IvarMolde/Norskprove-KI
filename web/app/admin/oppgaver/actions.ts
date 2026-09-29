"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdmin } from "@/lib/admin/auth";
import { oppgaveSchema } from "@/lib/admin/schemas";

export type OppgaveSkjemaState = {
  ok: boolean;
  melding: string;
};

const idSchema = z.union([z.uuid(), z.literal("")]);

function valgfriId(verdi: FormDataEntryValue | null) {
  const tekst = typeof verdi === "string" ? verdi : "";
  return tekst || null;
}

export async function lagreOppgave(
  _forrige: OppgaveSkjemaState,
  formData: FormData,
): Promise<OppgaveSkjemaState> {
  try {
    const idResultat = idSchema.safeParse(formData.get("id") ?? "");
    if (!idResultat.success) {
      return { ok: false, melding: "Oppgave-ID-en er ugyldig." };
    }

    let innhold: unknown;
    try {
      innhold = JSON.parse(String(formData.get("innhold") ?? ""));
    } catch {
      return { ok: false, melding: "Innhold må være gyldig JSON." };
    }

    const resultat = oppgaveSchema.safeParse({
      type: formData.get("type"),
      ferdighet: formData.get("ferdighet"),
      nivå: formData.get("nivå"),
      tema: String(formData.get("tema") ?? ""),
      kilde: formData.get("kilde"),
      status: formData.get("status"),
      kvalitetssjekket: formData.get("kvalitetssjekket") === "on",
      innhold,
      bilde_id: valgfriId(formData.get("bilde_id")),
      lydfil_id: valgfriId(formData.get("lydfil_id")),
    });

    if (!resultat.success) {
      return {
        ok: false,
        melding: resultat.error.issues[0]?.message ?? "Kontroller feltene.",
      };
    }

    const admin = await getAdmin();
    if (!admin) {
      return { ok: false, melding: "Du har ikke tilgang til denne handlingen." };
    }
    const { user, supabase } = admin;
    const data = {
      ...resultat.data,
      lyd_url: null,
      opprettet_av: user.id,
    };

    const spørring = idResultat.data
      ? supabase.from("oppgaver").update(resultat.data).eq("id", idResultat.data)
      : supabase.from("oppgaver").insert(data);
    const { error } = await spørring;

    if (error) {
      console.error("Kunne ikke lagre oppgave", { code: error.code });
      return { ok: false, melding: "Oppgaven kunne ikke lagres." };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/oppgaver");
    return { ok: true, melding: "Oppgaven er lagret." };
  } catch (error) {
    console.error("Uventet feil ved lagring av oppgave", error);
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}
