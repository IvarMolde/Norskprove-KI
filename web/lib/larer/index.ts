import { z } from "zod";
import { oktFeilTekst } from "@/lib/okt/feil";
import { createClient } from "@/lib/supabase/server";

const radSchema = z.object({
  id: z.string().uuid(),
  epost: z.string().email(),
  tittel: z.string().min(1),
  innsendt: z.string().min(1),
  ny: z.boolean(),
  har_kommentar: z.boolean(),
});

const larerKommentarSchema = z.object({
  niva: z.enum(["Under A1", "A1", "A2", "B1", "B2"]),
  kommentar: z.string().min(1),
});

const detaljSchema = radSchema.extend({
  oppgavetekst: z.string().min(1),
  bilde: z
    .object({
      url: z.string().regex(/^\/bilder\/[a-z0-9-]+\.(svg|png|webp)$/),
      beskrivelse: z.string().min(1),
    })
    .nullable(),
  svar: z.string().nullable(),
  larer: larerKommentarSchema.nullable(),
});

export type InnleveringRad = z.infer<typeof radSchema>;
export type InnleveringDetalj = z.infer<typeof detaljSchema>;

export type LarerResultat<T> =
  | { ok: true; data: T }
  | { ok: false; feil: string };

function somFeil(message: string | undefined): LarerResultat<never> {
  return { ok: false, feil: oktFeilTekst(message) };
}

export function datoTekst(iso: string): string {
  const dato = new Date(iso);
  if (Number.isNaN(dato.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dato);
}

export function nyTekst(antall: number): string {
  if (antall === 1) {
    return "Ny: 1 muntlig innlevering";
  }
  if (antall > 1) {
    return `Ny: ${antall} muntlige innleveringer`;
  }
  return "Muntlige innleveringer";
}

export async function antallUtenKommentar(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("antall_uten_larerkommentar");
    if (error) {
      console.error("antallUtenKommentar", error.code);
      return 0;
    }
    const antall = z.number().int().nonnegative().safeParse(data);
    return antall.success ? antall.data : 0;
  } catch (error) {
    console.error("antallUtenKommentar", error);
    return 0;
  }
}

export async function antallNyeMuntlige(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("antall_nye_muntlige");
    if (error) {
      console.error("antallNyeMuntlige", error.code);
      return 0;
    }
    const antall = z.number().int().nonnegative().safeParse(data);
    return antall.success ? antall.data : 0;
  } catch (error) {
    console.error("antallNyeMuntlige", error);
    return 0;
  }
}

export async function hentInnleveringer(): Promise<LarerResultat<InnleveringRad[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hent_muntlige_innleveringer");
    if (error) {
      console.error("hentInnleveringer", error.code);
      return somFeil(error.message);
    }
    const parsed = z.array(radSchema).safeParse(data);
    if (!parsed.success) {
      console.error("hentInnleveringer form");
      return somFeil(undefined);
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentInnleveringer", error);
    return somFeil(undefined);
  }
}

export async function hentInnlevering(
  svarId: string,
): Promise<LarerResultat<InnleveringDetalj>> {
  try {
    const id = z.string().uuid().safeParse(svarId);
    if (!id.success) {
      return somFeil("innlevering_mangler");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("hent_muntlig_innlevering", {
      p_svar_id: id.data,
    });
    if (error) {
      console.error("hentInnlevering", error.code);
      return somFeil(error.message);
    }
    const parsed = detaljSchema.safeParse(data);
    if (!parsed.success) {
      console.error("hentInnlevering form");
      return somFeil(undefined);
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    console.error("hentInnlevering", error);
    return somFeil(undefined);
  }
}

export async function markerHort(svarId: string): Promise<void> {
  try {
    const id = z.string().uuid().safeParse(svarId);
    if (!id.success) {
      return;
    }
    const supabase = await createClient();
    const { error } = await supabase.rpc("marker_muntlig_hort", {
      p_svar_id: id.data,
    });
    if (error) {
      console.error("markerHort", error.code);
    }
  } catch (error) {
    console.error("markerHort", error);
  }
}
