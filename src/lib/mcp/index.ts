import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMySurveys from "./tools/list-my-surveys";
import getSurveyResults from "./tools/get-survey-results";
import listMyResponses from "./tools/list-my-responses";
import getMyProfile from "./tools/get-my-profile";

// Direct Supabase auth issuer (RFC 8414). The `.lovable.cloud` proxy form
// SUPABASE_URL takes on publish would fail discovery-issuer matching.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "poll-your-people-mcp",
  title: "Poll Your People",
  version: "0.1.0",
  instructions:
    "Read tools for the signed-in Poll Your People user. Use `list_my_surveys` to see the polls they created, `get_survey_results` for aggregated results of a single poll (by slug), `list_my_responses` for polls they answered, and `get_my_profile` for their profile.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMySurveys, getSurveyResults, listMyResponses, getMyProfile],
});