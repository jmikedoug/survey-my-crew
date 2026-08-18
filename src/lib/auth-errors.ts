const CONFIG_HINT =
  "This site isn't configured to reach the backend yet. Check the deployment environment variables VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then redeploy with cache cleared.";

/** Turns raw auth/network errors into something a human can act on. */
export function describeAuthError(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message ?? "")
        : "";

  const lower = message.toLowerCase();
  if (
    lower.includes("invalid api key") ||
    lower.includes("no api key") ||
    lower.includes("expected 3 parts in jwt")
  ) {
    return CONFIG_HINT;
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
    return `Couldn't reach the backend. ${CONFIG_HINT}`;
  }
  return message || "Something went wrong. Please try again.";
}

/** True when the error means the deployment's backend keys are wrong/missing. */
export function isBackendConfigError(error: unknown): boolean {
  return describeAuthError(error).includes("environment variables");
}

export { CONFIG_HINT };
