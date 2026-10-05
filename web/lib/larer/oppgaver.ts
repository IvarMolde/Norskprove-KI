import { z } from "zod";
import {
  bildeAdresseSchema,
  bildeEndelseSchema,
  oppgaveBildeSchema,
} from "@/lib/oppgaver/bilde";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";

const oppgaveTypeSchema = z.enum([
  "individuell_fortelle",
  "individuell_beskrive_bilde",
]);

const listeSchema = z.object({
  id: z.string().uuid(),
  tittel: z.string().min(1),
  oppgavetype: oppgaveTypeSchema,
  nivagruppe: z.enum(["A1-A2", "A2-B1", "B1-B2"]),
  status: z.enum(["kladd", "publisert", "arkivert"]),
  bilde: oppgaveBildeSchema,
});

export const larerOppgaveSchema = listeSchema.extend({
  tekst: z.string().min(1),
  tema: z.string().nullable(),
  bilde: z
    .object({
      id: z.string().uuid(),
      url: bildeAdresseSchema,
      beskrivelse: z.string().min(1),
      endelse: bildeEndelseSchema,
    })
    .nullable(),
});

export type LarerOppgaveRad = z.infer<typeof listeSchema>;
export type LarerOppgave = z.infer<typeof larerOppgaveSchema>;

export type LarerOppgaveResultat<T> =
  | { ok: true; data: T }
  | { ok: false; feil: string };

function somFeil(message: string | undefined): LarerOppgaveResultat<never> {
  return { ok: false, feil: oktFeilTekst(message) };
}

export function typeEtikett(type: LarerOppgaveRad["oppgavetype"]): string {
  return type === "individuell_beskrive_bilde" ? "Beskriv bilde" : "Fortelle";
}

export function statusEtikett(status: LarerOppgaveRad["status"]): string {
  if (status === "publisert") {
    return "Publisert";
  }
  if (status === "arkivert") {
    return "Arkivert";
  }
  return "Kladd";
}

export async function hentLarerOppgaver(): Promise<
  LarerOppgaveResultat<LarerOppgaveRad[]>
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("larer_oppgaveliste");
    if (error) {
      console.error("hentLarerOppgaver", error.code);
      return somFeil(error.message);
    }
    const parsed = z.array(listeSchema).safeParse(data);
    if (!parsed.success) {
      console.error("hentLarerOppgaver form");
      return somFeil(undefined);
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentLarerOppgaver", error);
    return somFeil(undefined);
  }
}

export async function hentLarerOppgave(
  id: string,
): Promise<LarerOppgaveResultat<LarerOppgave>> {
  try {
    const oppgaveId = z.string().uuid().safeParse(id);
    if (!oppgaveId.success) {
      return somFeil("oppgave_ikke_funnet");
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("larer_hent_oppgave", {
      p_id: oppgaveId.data,
    });
    if (error) {
      console.error("hentLarerOppgave", error.code);
      return somFeil(error.message);
    }
    const parsed = larerOppgaveSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentLarerOppgave form");
      return somFeil(undefined);
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentLarerOppgave", error);
    return somFeil(undefined);
  }
}
