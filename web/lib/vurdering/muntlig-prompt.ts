import { readFileSync } from "node:fs";
import path from "node:path";

type PromptNokkel = "NIVAGRUPPE" | "OPPGAVETYPE" | "OPPGAVETEKST" | "TRANSKRIPSJON";

export type MuntligPromptVariabler = Record<PromptNokkel, string>;

function lesPromptFil(): string {
  const kandidater = [
    process.env.MUNTLIGPROMPT_PATH,
    path.resolve(process.cwd(), "../prompts/muntlig-vurdering-prompt.md"),
    path.resolve(process.cwd(), "prompts/muntlig-vurdering-prompt.md"),
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
export function muntligSystemprompt(): string {
  const raw = lesPromptFil();
  const overskrift = raw.indexOf("## Systemprompt");
  const apne = overskrift < 0 ? -1 : raw.indexOf("```", overskrift);
  const start = apne < 0 ? -1 : raw.indexOf("\n", apne);
  const slutt = start < 0 ? -1 : raw.indexOf("```", start + 1);

  if (start < 0 || slutt < 0) {
    throw new Error("vurdering_utilgjengelig");
  }

  const tekst = raw.slice(start + 1, slutt).replace(/\s+$/, "");
  if (!tekst.startsWith("Du er sensor") || !tekst.includes("{{TRANSKRIPSJON}}")) {
    throw new Error("vurdering_utilgjengelig");
  }

  return tekst;
}

/**
 * Første svar sendes alene. Senere svar tar med det eleven sa før,
 * slik at de språklige kriteriene gjelder hele økten. Formidling
 * bruker fortsatt bare oppgaveteksten for oppgaven som vurderes.
 */
export function transkripsjonForOkt(
  tidligere: { oppgavetype: string; svar: string }[],
  detteSvaret: string,
): string {
  const ferdige = tidligere.filter((del) => del.svar.trim().length > 0);
  if (ferdige.length === 0) {
    return detteSvaret;
  }

  const linjer = ferdige.map(
    (del, index) => `Oppgave ${index + 1} (${del.oppgavetype}):\n${del.svar.trim()}`,
  );
  return `${linjer.join("\n\n")}\n\nDette svaret:\n${detteSvaret}`;
}

/**
 * Bytter bare de fire variablene. Teksten eleven sa settes inn som verdi,
 * og blir ikke lest som en ny mal.
 */
export function fyllMuntligPrompt(
  mal: string,
  verdier: MuntligPromptVariabler,
): string {
  return mal.replace(
    /\{\{(NIVAGRUPPE|OPPGAVETYPE|OPPGAVETEKST|TRANSKRIPSJON)\}\}/g,
    (_treff, nokkel: keyof MuntligPromptVariabler) => verdier[nokkel],
  );
}
