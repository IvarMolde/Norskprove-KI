import { z } from "zod";

const nivaSchema = z.enum(["Under A1", "A1", "A2", "B1", "B2"]);

const kriteriumSchema = z.object({
  niva: nivaSchema,
});

const skriftSchema = z.object({
  id: z.string().uuid(),
  samlet_niva: nivaSchema,
  vurdert_dato: z.string().min(1),
  kriterier: z.object({
    tekstoppbygging: kriteriumSchema,
    rettskriving: kriteriumSchema,
    tegnsetting: kriteriumSchema,
    ordforrad: kriteriumSchema,
    grammatikk: kriteriumSchema,
  }),
});

const muntligSchema = z.object({
  id: z.string().uuid(),
  samlet_niva: nivaSchema,
  vurdert_dato: z.string().min(1),
  formidling: kriteriumSchema,
  sprakligekriterier: z.object({
    flyt: kriteriumSchema,
    uttale: kriteriumSchema,
    ordforrad: kriteriumSchema,
    grammatikk: kriteriumSchema,
  }),
});

const maaneder = [
  "jan.",
  "feb.",
  "mars",
  "apr.",
  "mai",
  "juni",
  "juli",
  "aug.",
  "sep.",
  "okt.",
  "nov.",
  "des.",
] as const;

export type UtviklingPunkt = {
  dato: string;
  niva: string;
};

export type UtviklingKriterium = {
  navn: string;
  punkter: UtviklingPunkt[];
};

function datoTekst(iso: string): string {
  const dato = new Date(iso);
  const maaned = maaneder[dato.getUTCMonth()] ?? "";
  return `${dato.getUTCDate()}. ${maaned} ${dato.getUTCFullYear()}`;
}

function punkter(
  rader: { vurdert_dato: string; niva: string }[],
): UtviklingPunkt[] {
  return [...rader]
    .sort((a, b) => a.vurdert_dato.localeCompare(b.vurdert_dato))
    .map((rad) => ({ dato: datoTekst(rad.vurdert_dato), niva: rad.niva }));
}

export function lesSkriftligUtvikling(data: unknown): UtviklingKriterium[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const rader = data.flatMap((rad) => {
    const lest = skriftSchema.safeParse(rad);
    return lest.success ? [lest.data] : [];
  });

  const linjer: { navn: string; felt: (rad: z.infer<typeof skriftSchema>) => string }[] = [
    { navn: "Samlet", felt: (rad) => rad.samlet_niva },
    { navn: "Tekstoppbygging", felt: (rad) => rad.kriterier.tekstoppbygging.niva },
    { navn: "Rettskriving", felt: (rad) => rad.kriterier.rettskriving.niva },
    { navn: "Tegnsetting", felt: (rad) => rad.kriterier.tegnsetting.niva },
    { navn: "Ordforråd", felt: (rad) => rad.kriterier.ordforrad.niva },
    { navn: "Grammatikk", felt: (rad) => rad.kriterier.grammatikk.niva },
  ];

  return linjer.map((linje) => ({
    navn: linje.navn,
    punkter: punkter(
      rader.map((rad) => ({ vurdert_dato: rad.vurdert_dato, niva: linje.felt(rad) })),
    ),
  }));
}

export function lesMuntligUtvikling(data: unknown): UtviklingKriterium[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const rader = data.flatMap((rad) => {
    const lest = muntligSchema.safeParse(rad);
    return lest.success ? [lest.data] : [];
  });

  const linjer: { navn: string; felt: (rad: z.infer<typeof muntligSchema>) => string }[] = [
    { navn: "Samlet", felt: (rad) => rad.samlet_niva },
    { navn: "Formidling", felt: (rad) => rad.formidling.niva },
    { navn: "Flyt", felt: (rad) => rad.sprakligekriterier.flyt.niva },
    { navn: "Uttale", felt: (rad) => rad.sprakligekriterier.uttale.niva },
    { navn: "Ordforråd", felt: (rad) => rad.sprakligekriterier.ordforrad.niva },
    { navn: "Grammatikk", felt: (rad) => rad.sprakligekriterier.grammatikk.niva },
  ];

  return linjer.map((linje) => ({
    navn: linje.navn,
    punkter: punkter(
      rader.map((rad) => ({ vurdert_dato: rad.vurdert_dato, niva: linje.felt(rad) })),
    ),
  }));
}
