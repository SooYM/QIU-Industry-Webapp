// Reads the signed-in student's course from the Google Workspace directory via
// the People API, then resolves it to a known QIU course. The OAuth access token
// comes from the Firebase Google sign-in credential (see auth-context).
//
// Prerequisites (setup, not code):
//   1. The course code must be populated in the user's directory profile
//      (organizations[].title / .department, or occupations).
//   2. The sign-in must request the `directory.readonly` scope and the user
//      must consent. If unavailable, callers fall back to a stored course.
import { resolveCourse } from "../data/course-map";

export const PEOPLE_SCOPE = "https://www.googleapis.com/auth/directory.readonly";

type PeopleResponse = {
  organizations?: { title?: string; department?: string; name?: string }[];
  occupations?: { value?: string }[];
};

/**
 * Fetch the raw course string from People API, or null if unavailable.
 * Never throws — directory access is best-effort.
 */
export async function fetchDirectoryCourse(accessToken: string): Promise<{ code: string; name: string } | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch(
      "https://people.googleapis.com/v1/people/me?personFields=organizations,occupations",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as PeopleResponse;
    const candidates = [
      ...(data.organizations ?? []).flatMap((o) => [o.title, o.department, o.name]),
      ...(data.occupations ?? []).map((o) => o.value),
    ].filter(Boolean) as string[];
    for (const candidate of candidates) {
      const resolved = resolveCourse(candidate);
      if (resolved && resolved.code) return resolved; // a recognised code wins
    }
    // No recognised code — return the first free-text candidate if any.
    return candidates.length ? resolveCourse(candidates[0]) : null;
  } catch {
    return null;
  }
}
