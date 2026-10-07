import { gjenopptaOkt, pauseOkt } from "../../ov/pause-actions";
import { PauseSkjema } from "../../ov/pause-skjema";

export function PauseKnapp({ oktId }: { oktId: string }) {
  return (
    <PauseSkjema
      etikett="Pause"
      handling={pauseOkt.bind(null, "adaptiv")}
      oktId={oktId}
      venterTekst="Pauser…"
    />
  );
}

export function GjenopptaKnapp({ oktId }: { oktId: string }) {
  return (
    <PauseSkjema
      etikett="Fortsett økten"
      handling={gjenopptaOkt.bind(null, "adaptiv")}
      oktId={oktId}
      venterTekst="Fortsetter…"
    />
  );
}
