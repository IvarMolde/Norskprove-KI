import Link from "next/link";
import { antallNyeMuntlige, nyTekst } from "@/lib/larer";
import { erLarer } from "@/lib/rolle";

export async function LarerLenke() {
  const larer = await erLarer();
  if (!larer) {
    return null;
  }

  const antall = await antallNyeMuntlige();

  return (
    <p>
      <Link href="/larer">{nyTekst(antall)}</Link>
    </p>
  );
}
