import Link from "next/link";
import { antallNyeMuntlige, antallUtenKommentar, nyTekst } from "@/lib/larer";
import { erLarer } from "@/lib/rolle";

export async function LarerLenke() {
  const larer = await erLarer();
  if (!larer) {
    return null;
  }

  const antall = await antallNyeMuntlige();
  const uten = await antallUtenKommentar();
  const tekst =
    antall > 0
      ? nyTekst(antall)
      : uten === 1
        ? "Mangler kommentar: 1"
        : uten > 1
          ? `Mangler kommentar: ${uten}`
          : "Muntlige innleveringer";

  return (
    <p>
      <Link href="/larer">{tekst}</Link>
    </p>
  );
}
