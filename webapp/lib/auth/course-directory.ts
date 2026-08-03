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
  organizations?: { title?: string; department?: string; name?: string; costCenter?: string; symbol?: string; description?: string }[];
  occupations?: { value?: string }[];
  externalIds?: { value?: string; type?: string; formattedType?: string }[];
  userDefined?: { key?: string; value?: string }[];
};

export interface DirectoryProfile {
  course: { code: string; name: string } | null;
  /** Google Workspace "Employee ID" — surfaced to admins for roster matching. */
  employeeId: string | null;
}

/**
 * Pull the Workspace employee ID from a People API domain profile. Google stores
 * it inconsistently across tenants — most commonly in externalIds (type
 * "organization"), but some domains put it in organizations.costCenter/symbol or
 * a userDefined field. Scan them all, preferring the most explicit.
 */
function extractEmployeeId(data: PeopleResponse): string | null {
  const clean = (v?: string) => (v ?? "").trim();
  const ids = data.externalIds ?? [];
  const typed = ids.find((e) => /organ|employee|emp|staff|student|id/i.test(`${e.type ?? ""} ${e.formattedType ?? ""}`));
  const userDef = (data.userDefined ?? []).find((u) => /employee|emp|staff|student|\bid\b/i.test(u.key ?? ""));
  const orgs = data.organizations ?? [];
  const candidate =
    clean(typed?.value) ||
    clean(ids[0]?.value) ||
    clean(userDef?.value) ||
    clean(orgs.find((o) => o.costCenter)?.costCenter) ||
    clean(orgs.find((o) => o.symbol)?.symbol);
  return candidate || null;
}

/**
 * Fetch the student's directory course + employee ID from People API. Never
 * throws — directory access is best-effort and returns nulls on any failure.
 * `sources=READ_SOURCE_TYPE_PROFILE` is required so the admin-set DOMAIN profile
 * fields (employee ID, org unit) are returned, not just the user's own profile.
 */
export async function fetchDirectoryProfile(accessToken: string): Promise<DirectoryProfile> {
  const empty: DirectoryProfile = { course: null, employeeId: null };
  if (!accessToken) return empty;
  try {
    const res = await fetch(
      "https://people.googleapis.com/v1/people/me?personFields=organizations,occupations,externalIds,userDefined&sources=READ_SOURCE_TYPE_PROFILE",
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
