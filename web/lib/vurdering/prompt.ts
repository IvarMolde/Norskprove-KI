import { readFileSync } from "node:fs";
import path from "node:path";

type PromptNokkel =
  | "NIVAGRUPPE"
  | "OPPGAVETYPE"
  | "OPPGAVETEKST"
  | "MIN_ORDANTALL"
  | "ELEVSVAR";

export type PromptVariabler = Record<PromptNokkel, string>;

function lesPromptFil(): string {
  const kandidater = [
    process.env.SKRIVEPROMPT_PATH,
    path.resolve(process.cwd(), "../prompts/skriveprove-vurdering-prompt.md"),
    path.resolve(process.cwd(), "prompts/skriveprove-vurdering-prompt.md"),
  ].filter((verdi): verdi is string => Boolean(verdi));

  for (const fil of kandidater) {
    try {
      return readFileSync(fil, "utf8");
    } catch {
      // Prøv neste sted promptfilen kan ligge.
    }
  }

  throw new Error("vurdering_utilgjengelig");
}

/** Systemprompten i promptfilen, uten endringer i teksten. */
export function systemprompt(): string {
  const raw = lesPromptFil();
  const overskrift = raw.indexOf("## Systemprompt");
  const apne = overskrift < 0 ? -1 : raw.indexOf("```", overskrift);
  const start = apne < 0 ? -1 : raw.indexOf("\n", apne);
  const slutt = start < 0 ? -1 : raw.indexOf("```", start + 1);

  if (start < 0 || slutt < 0) {
    throw new Error("vurdering_utilgjengelig");
  }

  const tekst = raw.slice(start + 1, slutt).replace(/\s+$/, "");
  if (!tekst.startsWith("Du er sensor") || !tekst.includes("{{ELEVSVAR}}")) {
    throw new Error("vurdering_utilgjengelig");
  }

  return tekst;
}

/**
 * Bytter bare de fem variablene. Elevteksten settes inn som verdi,
 * og blir ikke lest som en ny mal.
 */
export function fyllPrompt(mal: string, verdier: PromptVariabler): string {
  return mal.replace(
    /\{\{(NIVAGRUPPE|OPPGAVETYPE|OPPGAVETEKST|MIN_ORDANTALL|ELEVSVAR)\}\}/g,
    (_treff, nokkel: keyof PromptVariabler) => verdier[nokkel],
  );
}
