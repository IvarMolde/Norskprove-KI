import { gjenopptaOkt, pauseOkt } from "../pause-actions";
import { PauseSkjema } from "../pause-skjema";

export function PauseKnapp({ oktId }: { oktId: string }) {
  return (
    <PauseSkjema
      etikett="Pause"
      handling={pauseOkt.bind(null, "lytting")}
      oktId={oktId}
      venterTekst="Pauser…"
    />
  );
}

export function GjenopptaKnapp({ oktId }: { oktId: string }) {
  return (
    <PauseSkjema
      etikett="Fortsett økten"
      handling={gjenopptaOkt.bind(null, "lytting")}
      oktId={oktId}
      venterTekst="Fortsetter…"
    />
  );
}
