export function MuntligBilde({
  url,
  beskrivelse,
}: {
  url: string;
  beskrivelse: string;
}) {
  return (
    <figure>
      <img
        alt={beskrivelse}
        className="h-auto max-w-full rounded border border-current"
        src={url}
      />
    </figure>
  );
}
