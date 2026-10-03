export function LagreLinje({
  status,
  feil,
}: {
  status: string | null;
  feil: string | null;
}) {
  return (
    <>
      {status ? <p aria-live="polite">{status}</p> : null}
      {feil ? <p role="alert">{feil}</p> : null}
    </>
  );
}
