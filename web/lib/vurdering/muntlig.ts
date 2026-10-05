import {
  muntligVurderingSchema,
  type MuntligVurdering,
} from "@/lib/oppgaver/muntlig";

type Kall = {
  choices?: { message?: { content?: string | null } }[];
};

const nivaSkjema = {
  type: "string",
  enum: ["Under A1", "A1", "A2", "B1", "B2"],
};

const kriteriumSkjema = {
  type: "object",
  properties: {
    niva: nivaSkjema,
    begrunnelse: { type: "string", maxLength: 280 },
  },
  required: ["niva", "begrunnelse"],
  additionalProperties: false,
};

const jsonSkjema = {
  type: "json_schema",
  json_schema: {
    name: "muntlig_vurdering",
    strict: true,
    schema: {
      type: "object",
      properties: {
        formidling: kriteriumSkjema,
        sprakligekriterier: {
          type: "object",
          properties: {
            flyt: kriteriumSkjema,
            uttale: kriteriumSkjema,
            ordforrad: kriteriumSkjema,
            grammatikk: kriteriumSkjema,
          },
          required: ["flyt", "uttale", "ordforrad", "grammatikk"],
          additionalProperties: false,
        },
        samlet_niva: nivaSkjema,
        forbedringspunkter: {
          type: "array",
          items: { type: "string", maxLength: 200 },
          minItems: 2,
          maxItems: 2,
        },
        positivt_element: { type: "string", maxLength: 200 },
        tilbakemelding_til_elev: { type: "string", maxLength: 450 },
        usikker_vurdering: { type: "boolean" },
        usikker_pga_lyd: { type: "boolean" },
      },
      required: [
        "formidling",
        "sprakligekriterier",
        "samlet_niva",
        "forbedringspunkter",
        "positivt_element",
        "tilbakemelding_til_elev",
        "usikker_vurdering",
        "usikker_pga_lyd",
      ],
      additionalProperties: false,
    },
  },
};

function lesJson(tekst: string): unknown {
  const trimmet = tekst.trim();
  try {
    return JSON.parse(trimmet) as unknown;
  } catch {
    const start = trimmet.indexOf("{");
    const slutt = trimmet.lastIndexOf("}");
    if (start < 0 || slutt <= start) {
      throw new Error("vurdering_feilet");
    }
    return JSON.parse(trimmet.slice(start, slutt + 1)) as unknown;
  }
}

async function kallModell(
  base: string,
  nokkel: string,
  body: Record<string, unknown>,
): Promise<Kall> {
  try {
    const svar = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${nokkel}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
    });

    if (svar.status === 400 && "response_format" in body) {
      throw new Error("vurdering_format");
    }

    if (!svar.ok) {
      console.error("vurderMuntlig http", svar.status);
      throw new Error("vurdering_feilet");
    }

    return (await svar.json()) as Kall;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "vurdering_format" || error.message === "vurdering_feilet")
    ) {
      throw error;
    }
    console.error(
      "vurderMuntlig",
      error instanceof Error ? error.name : "ukjent",
    );
    throw new Error("vurdering_feilet");
  }
}

const modellnavn = /qwen|alibaba|openai|chatgpt|gpt-4|llama/i;

function utenSignatur(tekst: string): string {
  const deler = tekst
    .split(/(?<=[.!?])\s+/)
    .filter((del) => !modellnavn.test(del));
  const samlet = deler.join(" ").trim();
  return samlet.length > 0 ? samlet : tekst.trim();
}

function utenModellsignatur(vurdering: MuntligVurdering): MuntligVurdering {
  const punkter = vurdering.forbedringspunkter.map((punkt) => {
    const renset = utenSignatur(punkt);
    return renset.length > 0 ? renset : punkt;
  });

  return {
    ...vurdering,
    positivt_element: utenSignatur(vurdering.positivt_element),
    tilbakemelding_til_elev: utenSignatur(vurdering.tilbakemelding_til_elev),
    forbedringspunkter: [punkter[0], punkter[1]],
    usikker_pga_lyd: true,
  };
}

function lesVurdering(data: Kall): MuntligVurdering | null {
  const innhold = data.choices?.[0]?.message?.content;
  if (!innhold) {
    return null;
  }

  try {
    const parsed = muntligVurderingSchema.safeParse(lesJson(innhold));
    return parsed.success ? utenModellsignatur(parsed.data) : null;
  } catch {
    return null;
  }
}

/**
 * Hele teksten i kallet er den utfylte systemprompten.
 * Lydfilen sendes ikke med. usikker_pga_lyd blir derfor alltid sant.
 */
export async function vurderMuntlig(prompt: string): Promise<MuntligVurdering> {
  const nokkel = process.env.OPENAI_API_KEY;
  const base = (
    process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  if (!nokkel || base.includes("supabase.co")) {
    console.error("vurderMuntlig mangler_modell");
    throw new Error("vurdering_utilgjengelig");
  }

  const felles = {
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 1100,
    messages: [{ role: "user", content: prompt }],
  };

  const forsok = [
    { ...felles, response_format: jsonSkjema },
    { ...felles, response_format: { type: "json_object" } },
    felles,
  ];

  let data: Kall | null = null;
  let brukt = forsok[0];
  for (const kropp of forsok) {
    try {
      data = await kallModell(base, nokkel, kropp);
      brukt = kropp;
      break;
    } catch (error) {
      if (error instanceof Error && error.message === "vurdering_format") {
        continue;
      }
      throw error;
    }
  }

  const forste = data ? lesVurdering(data) : null;
  if (forste) {
    return forste;
  }

  const nytt = await kallModell(base, nokkel, brukt);
  const andre = lesVurdering(nytt);
  if (!andre) {
    console.error("vurderMuntlig ugyldig_json");
    throw new Error("vurdering_feilet");
  }

  return andre;
}
