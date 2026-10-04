import {
  skriveVurderingSchema,
  type SkriveVurdering,
} from "@/lib/oppgaver/skriving";

type Kall = {
  choices?: { message?: { content?: string | null } }[];
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
      signal: AbortSignal.timeout(120_000),
    });

    if (svar.status === 400 && "response_format" in body) {
      throw new Error("vurdering_format");
    }

    if (!svar.ok) {
      console.error("vurderTekst http", svar.status);
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
      "vurderTekst",
      error instanceof Error ? error.name : "ukjent",
    );
    throw new Error("vurdering_feilet");
  }
}

function lesVurdering(data: Kall): SkriveVurdering | null {
  const innhold = data.choices?.[0]?.message?.content;
  if (!innhold) {
    return null;
  }

  try {
    const parsed = skriveVurderingSchema.safeParse(lesJson(innhold));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Hele forespørselen er den utfylte systemprompten.
 * Ett nytt forsøk bruker samme tekst hvis svaret ikke er gyldig JSON.
 */
export async function vurderTekst(prompt: string): Promise<SkriveVurdering> {
  const nokkel = process.env.OPENAI_API_KEY;
  const base = (
    process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  if (!nokkel || base.includes("supabase.co")) {
    console.error("vurderTekst mangler_modell");
    throw new Error("vurdering_utilgjengelig");
  }

  const felles = {
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  };

  let data: Kall;
  try {
    data = await kallModell(base, nokkel, {
      ...felles,
      response_format: { type: "json_object" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "vurdering_format") {
      data = await kallModell(base, nokkel, felles);
    } else {
      throw error;
    }
  }

  const forste = lesVurdering(data);
  if (forste) {
    return forste;
  }

  const nytt = await kallModell(base, nokkel, felles);
  const andre = lesVurdering(nytt);
  if (!andre) {
    console.error("vurderTekst ugyldig_json");
    throw new Error("vurdering_feilet");
  }

  return andre;
}
