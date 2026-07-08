// Client-only helper. Uses localStorage as a lightweight "who created this"
// marker so a person can list & manage their own surveys without an account.
// When real auth lands, migrate rows: set surveys.user_id where creator_token
// matches a value the user proves ownership of.

const TOKEN_KEY = "ppp.creator_token";
const SURVEYS_KEY = "ppp.my_surveys";

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getCreatorToken(): string {
  if (typeof window === "undefined") return "";
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = randomToken();
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

export type MySurvey = { slug: string; title: string; created_at: string };

export function listMySurveys(): MySurvey[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SURVEYS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function rememberSurvey(s: MySurvey) {
  if (typeof window === "undefined") return;
  const all = listMySurveys().filter((x) => x.slug !== s.slug);
  all.unshift(s);
  localStorage.setItem(SURVEYS_KEY, JSON.stringify(all.slice(0, 50)));
}

export function forgetSurvey(slug: string) {
  if (typeof window === "undefined") return;
  const all = listMySurveys().filter((x) => x.slug !== slug);
  localStorage.setItem(SURVEYS_KEY, JSON.stringify(all));
}