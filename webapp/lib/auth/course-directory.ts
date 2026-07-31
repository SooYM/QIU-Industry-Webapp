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
  externalIds?: { value?: string; type?: string; formattedType?: string }[];
};

export interface DirectoryProfile {
  course: { code: string; name: string } | null;
  /** Google Workspace "Employee ID" — surfaced to admins for roster matching. */
  employeeId: string | null;
}

/** Pull the Workspace employee ID from People API externalIds / organizations. */
function extractEmployeeId(data: PeopleResponse): string | null {
  const ids = data.externalIds ?? [];
  // Prefer an entry explicitly typed as an organisation/employee id, else the first.
  const preferred = ids.find((e) => /organ|employee|account/i.test(`${e.type ?? ""} ${e.formattedType ?? ""}`));
  return (preferred?.value || ids[0]?.value || "").trim() || null;
}

/**
 * Fetch the student's directory course + employee ID from People API. Never
 * throws — directory access is best-effort and returns nulls on any failure.
 */
export async function fetchDirectoryProfile(accessToken: string): Promise<DirectoryProfile> {
  const empty: DirectoryProfile = { course: null, employeeId: null };
  if (!accessToken) return empty;
  try {
    const res = await fetch(
      "https://people.googleapis.com/v1/people/me?personFields=organizations,occupations,externalIds",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return empty;
    const data = (await res.json()) as PeopleResponse;
    const employeeId = extractEmployeeId(data);
    const candidates = [
      ...(data.organizations ?? []).flatMap((o) => [o.title, o.department, o.name]),
      ...(data.occupations ?? []).map((o) => o.value),
    ].filter(Boolean) as string[];
    for (const candidate of candidates) {
      const resolved = resolveCourse(candidate);
      if (resolved && resolved.code) return { course: resolved, employeeId }; // a recognised code wins
    }
    return { course: candidates.length ? resolveCourse(candidates[0]) : null, employeeId };
  } catch {
    return empty;
  }
}
