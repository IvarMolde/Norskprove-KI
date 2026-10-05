export function MuntligBilde({
  url,
  beskrivelse,
  endelse,
}: {
  url: string;
  beskrivelse: string;
  endelse?: "png" | "webp" | "svg" | "pdf";
}) {
  if (endelse === "pdf" || url.endsWith(".pdf")) {
    return (
      <figure>
        <iframe
          className="h-96 w-full rounded border border-current"
          src={url}
          title={beskrivelse}
        />
      </figure>
    );
  }

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
