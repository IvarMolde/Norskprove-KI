import { z } from "zod";
import { normaliserOrd } from "@/lib/oppgaver/ord";

export const LESETYPER = [
  "pastand_korrekt",
  "fyll_inn",
  "synonym",
  "antonym",
  "rekkefolge",
] as const;

export const NIVA = ["A1", "A2", "B1", "B2"] as const;

export const TYPE_ETIKETT: Record<(typeof LESETYPER)[number], string> = {
  pastand_korrekt: "Påstand",
  fyll_inn: "Fyll inn",
  synonym: "Synonym",
  antonym: "Antonym",
  rekkefolge: "Rekkefølge",
};

export const STATUS_ETIKETT = {
  kladd: "Kladd",
  publisert: "Publisert",
  arkivert: "Arkivert",
} as const;

export type Lesetype = (typeof LESETYPER)[number];
export type Niva = (typeof NIVA)[number];
export type OppgaveStatus = keyof typeof STATUS_ETIKETT;

const tekst = z.string().trim().min(1);
const idFelt = z.string().trim().min(1);
const beholdTekst = z.string().refine((verdi) => verdi.trim().length > 0);

const pastandLedd = z
  .object({
    id: idFelt,
    tekst,
    korrekt: z.boolean(),
  })
  .strict();

export const pastandInnholdSchema = z
  .object({
    tittel: tekst,
    tekst,
    pastander: z.tuple([pastandLedd, pastandLedd]),
  })
  .strict()
  .superRefine((verdi, ctx) => {
    if (verdi.pastander[0].id === verdi.pastander[1].id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ugyldig_innhold",
      });
    }
  });

export const fyllInnInnholdSchema = z
  .object({
    tittel: tekst,
    tekst,
    deler: z.tuple([
      z.object({ type: z.literal("tekst"), tekst: beholdTekst }).strict(),
      z.object({ type: z.literal("hull"), id: idFelt }).strict(),
      z.object({ type: z.literal("tekst"), tekst: beholdTekst }).strict(),
    ]),
    fasit: z.tuple([
      z
        .object({
          id: idFelt,
          ord: z.tuple([tekst]),
        })
        .strict(),
    ]),
  })
  .strict()
  .superRefine((verdi, ctx) => {
    const hullId = verdi.deler[1].id;
    const ord = verdi.fasit[0].ord[0];
    if (verdi.fasit[0].id !== hullId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ugyldig_innhold",
        path: ["fasit"],
      });
    }
    const normalOrd = normaliserOrd(ord);
    if (normalOrd.length > 0 && normaliserOrd(hullId).includes(normalOrd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ugyldig_innhold",
        path: ["fasit"],
      });
    }
  });

const alternativ = z
  .object({
    id: idFelt,
    tekst,
  })
  .strict();

export const ordvalgInnholdSchema = z
  .object({
    tittel: tekst,
    ord: tekst,
    setning: tekst,
    alternativer: z.tuple([alternativ, alternativ, alternativ]),
    korrekt: idFelt,
  })
  .strict()
  .superRefine((verdi, ctx) => {
    const ids = verdi.alternativer.map((alt) => alt.id);
    if (new Set(ids).size !== ids.length || !ids.includes(verdi.korrekt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ugyldig_innhold",
      });
    }
  });

const ledd = z
  .object({
    id: idFelt,
    tekst,
  })
  .strict();

export const rekkefolgeInnholdSchema = z
  .object({
    tittel: tekst,
    ledd: z.tuple([ledd, ledd, ledd]),
    visning: z.tuple([idFelt, idFelt, idFelt]),
    riktig: z.tuple([idFelt, idFelt, idFelt]),
  })
  .strict()
  .superRefine((verdi, ctx) => {
    const ids = verdi.ledd.map((rad) => rad.id);
    const omvendt = [ids[2], ids[1], ids[0]];
    const unik = new Set(ids).size === 3;
    const riktig = verdi.riktig.every((rad, index) => rad === ids[index]);
    const visning = verdi.visning.every((rad, index) => rad === omvendt[index]);
    if (!unik || !riktig || !visning) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ugyldig_innhold",
      });
    }
  });

export function erLesetype(verdi: string): verdi is Lesetype {
  return (LESETYPER as readonly string[]).includes(verdi);
}

export function erNiva(verdi: string): verdi is Niva {
  return (NIVA as readonly string[]).includes(verdi);
}

type PastandInnhold = z.infer<typeof pastandInnholdSchema>;
type OrdvalgInnhold = z.infer<typeof ordvalgInnholdSchema>;
type RekkefolgeInnhold = z.infer<typeof rekkefolgeInnholdSchema>;

export type SkjemaInnhold =
  | {
      type: "pastand_korrekt";
      tittel: string;
      tekst: string;
      pastander: PastandInnhold["pastander"];
    }
  | {
      type: "fyll_inn";
      tittel: string;
      tekst: string;
      foran: string;
      hullId: string;
      etter: string;
      ord: string;
    }
  | {
      type: "synonym" | "antonym";
      tittel: string;
      ord: string;
      setning: string;
      alternativer: OrdvalgInnhold["alternativer"];
      korrekt: string;
    }
  | {
      type: "rekkefolge";
      tittel: string;
      ledd: RekkefolgeInnhold["ledd"];
    };

export function tomtSkjema(type: Lesetype): SkjemaInnhold {
  if (type === "pastand_korrekt") {
    return {
      type,
      tittel: "",
      tekst: "",
      pastander: [
        { id: "p1", tekst: "", korrekt: true },
        { id: "p2", tekst: "", korrekt: false },
      ],
    };
  }
  if (type === "fyll_inn") {
    return {
      type,
      tittel: "",
      tekst: "",
      foran: "",
      hullId: "hull-1",
      etter: "",
      ord: "",
    };
  }
  if (type === "rekkefolge") {
    return {
      type,
      tittel: "",
      ledd: [
        { id: "l1", tekst: "" },
        { id: "l2", tekst: "" },
        { id: "l3", tekst: "" },
      ],
    };
  }
  return {
    type,
    tittel: "",
    ord: "",
    setning: "",
    alternativer: [
      { id: "a1", tekst: "" },
      { id: "a2", tekst: "" },
      { id: "a3", tekst: "" },
    ],
    korrekt: "a1",
  };
}

export function innholdTilSkjema(
  type: Lesetype,
  innhold: unknown,
): SkjemaInnhold | null {
  if (type === "pastand_korrekt") {
    const parsed = pastandInnholdSchema.safeParse(innhold);
    if (!parsed.success) {
      return null;
    }
    return { type, ...parsed.data };
  }
  if (type === "fyll_inn") {
    const parsed = fyllInnInnholdSchema.safeParse(innhold);
    if (!parsed.success) {
      return null;
    }
    return {
      type,
      tittel: parsed.data.tittel,
      tekst: parsed.data.tekst,
      foran: parsed.data.deler[0].tekst,
      hullId: parsed.data.deler[1].id,
      etter: parsed.data.deler[2].tekst,
      ord: parsed.data.fasit[0].ord[0],
    };
  }
  if (type === "synonym" || type === "antonym") {
    const parsed = ordvalgInnholdSchema.safeParse(innhold);
    if (!parsed.success) {
      return null;
    }
    return { type, ...parsed.data };
  }
  const parsed = rekkefolgeInnholdSchema.safeParse(innhold);
  if (!parsed.success) {
    return null;
  }
  return { type, tittel: parsed.data.tittel, ledd: parsed.data.ledd };
}

export const redaktorRadSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(LESETYPER),
  niva: z.enum(NIVA),
  tema: z.string().nullable(),
  status: z.enum(["kladd", "publisert", "arkivert"]),
  navn: z.string(),
});

export const redaktorOppgaveSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(LESETYPER),
  niva: z.enum(NIVA),
  tema: z.string().nullable(),
  status: z.enum(["kladd", "publisert", "arkivert"]),
  innhold: z.unknown(),
});

export type RedaktorRad = z.infer<typeof redaktorRadSchema>;
export type RedaktorOppgave = z.infer<typeof redaktorOppgaveSchema>;

export type LagreSkjema = {
  id: string | null;
  type: Lesetype;
  niva: Niva;
  tema: string | null;
  status: "kladd" | "publisert";
  innhold: unknown;
};

function felt(formData: FormData, navn: string): string {
  const verdi = formData.get(navn);
  return typeof verdi === "string" ? verdi : "";
}

function innholdFraFelter(type: Lesetype, formData: FormData): unknown {
  if (type === "pastand_korrekt") {
    return {
      tittel: felt(formData, "tittel"),
      tekst: felt(formData, "tekst"),
      pastander: [1, 2].map((nummer) => ({
        id: felt(formData, `p${nummer}_id`),
        tekst: felt(formData, `p${nummer}_tekst`),
        korrekt: felt(formData, `p${nummer}_korrekt`) === "ja",
      })),
    };
  }

  if (type === "fyll_inn") {
    const hullId = felt(formData, "hull_id");
    return {
      tittel: felt(formData, "tittel"),
      tekst: felt(formData, "tekst"),
      deler: [
        { type: "tekst", tekst: felt(formData, "foran") },
        { type: "hull", id: hullId },
        { type: "tekst", tekst: felt(formData, "etter") },
      ],
      fasit: [{ id: hullId, ord: [felt(formData, "ord")] }],
    };
  }

  if (type === "rekkefolge") {
    const leddRader = [1, 2, 3].map((nummer) => ({
      id: felt(formData, `l${nummer}_id`),
      tekst: felt(formData, `l${nummer}_tekst`),
    }));
    const riktig = leddRader.map((rad) => rad.id);
    return {
      tittel: felt(formData, "tittel"),
      ledd: leddRader,
      riktig,
      visning: [riktig[2], riktig[1], riktig[0]],
    };
  }

  return {
    tittel: felt(formData, "tittel"),
    ord: felt(formData, "ord"),
    setning: felt(formData, "setning"),
    alternativer: [1, 2, 3].map((nummer) => ({
      id: felt(formData, `a${nummer}_id`),
      tekst: felt(formData, `a${nummer}_tekst`),
    })),
    korrekt: felt(formData, "korrekt"),
  };
}

function schemaFor(type: Lesetype) {
  if (type === "pastand_korrekt") {
    return pastandInnholdSchema;
  }
  if (type === "fyll_inn") {
    return fyllInnInnholdSchema;
  }
  if (type === "rekkefolge") {
    return rekkefolgeInnholdSchema;
  }
  return ordvalgInnholdSchema;
}

export function lesSkjema(
  formData: FormData,
): { ok: true; data: LagreSkjema } | { ok: false } {
  const type = felt(formData, "type");
  const niva = felt(formData, "niva");
  const status = felt(formData, "maal");
  if (!erLesetype(type) || !erNiva(niva)) {
    return { ok: false };
  }
  if (status !== "kladd" && status !== "publisert") {
    return { ok: false };
  }
  if (type === "pastand_korrekt") {
    const forste = felt(formData, "p1_korrekt");
    const andre = felt(formData, "p2_korrekt");
    if (
      (forste !== "ja" && forste !== "nei") ||
      (andre !== "ja" && andre !== "nei")
    ) {
      return { ok: false };
    }
  }

  const idRå = felt(formData, "id").trim();
  let id: string | null = null;
  if (idRå.length > 0) {
    const parsedId = z.string().uuid().safeParse(idRå);
    if (!parsedId.success) {
      return { ok: false };
    }
    id = parsedId.data;
  }

  const parsed = schemaFor(type).safeParse(innholdFraFelter(type, formData));
  if (!parsed.success) {
    return { ok: false };
  }

  const tema = felt(formData, "tema").trim();
  return {
    ok: true,
    data: {
      id,
      type,
      niva,
      tema: tema.length > 0 ? tema : null,
      status,
      innhold: parsed.data,
    },
  };
}
