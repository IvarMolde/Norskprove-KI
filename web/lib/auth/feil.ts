type AuthFeil = {
  message?: string;
  code?: string;
};

function samlet(error: AuthFeil): string {
  return `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
}

export function innloggingFeilTekst(
  error: AuthFeil,
  handling: "inn" | "registrer",
): string {
  const tekst = samlet(error);

  if (
    tekst.includes("invalid_credentials") ||
    tekst.includes("invalid login")
  ) {
    return "E-post eller passord er feil.";
  }

  if (
    tekst.includes("user_already_exists") ||
    tekst.includes("email_exists") ||
    tekst.includes("already registered") ||
    tekst.includes("already been registered")
  ) {
    return "Denne e-posten er allerede i bruk.";
  }

  if (tekst.includes("rate limit") || tekst.includes("over_request_rate_limit")) {
    return "Vent litt, og prøv igjen.";
  }

  if (
    tekst.includes("weak_password") ||
    (tekst.includes("password") && tekst.includes("at least"))
  ) {
    return "Passordet må ha minst 6 tegn.";
  }

  if (
    tekst.includes("email_address_invalid") ||
    tekst.includes("unable to validate email")
  ) {
    return "Skriv en gyldig e-post.";
  }

  if (handling === "inn") {
    return "Vi fikk ikke logget deg inn. Prøv igjen.";
  }

  return "Vi fikk ikke opprettet kontoen. Prøv igjen.";
}
