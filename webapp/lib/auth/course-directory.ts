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
  /** TEMP: raw People API payloads, for locating the employee-ID field. */
  raw?: unknown;
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
 * The admin-set "Employee ID" lives in the DOMAIN directory, not the user's own
 * `people/me` profile — so we query the same directory-search endpoint that powers
 * the Google Contacts directory card (which any domain user can view). Returns the
 * matching person's profile, or null.
 */
async function fetchDirectoryPerson(accessToken: string, email: string): Promise<PeopleResponse | null> {
  if (!email) return null;
  try {
    const url = "https://people.googleapis.com/v1/people:searchDirectoryPeople"
      + `?query=${encodeURIComponent(email)}&pageSize=10`
      + "&readMask=emailAddresses,externalIds,organizations,occupations,relations,userDefined"
      + "&sources=DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE&sources=DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT";
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as { people?: (PeopleResponse & { emailAddresses?: { value?: string }[] })[] };
    const people = data.people ?? [];
    const lower = email.toLowerCase();
    return people.find((p) => (p.emailAddresses ?? []).some((e) => (e.value ?? "").toLowerCase() === lower)) ?? people[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the student's directory course + employee ID. Course comes from the
 * user's own `people/me` profile; the employee ID from a directory search (the
 * data source the Contacts directory card uses). Never throws — best-effort.
 */
export async function fetchDirectoryProfile(accessToken: string, email?: string): Promise<DirectoryProfile> {
  const empty: DirectoryProfile = { course: null, employeeId: null };
  if (!accessToken) return empty;
  try {
    const res = await fetch(
      "https://people.googleapis.com/v1/people/me?personFields=organizations,occupations,externalIds,userDefined&sources=READ_SOURCE_TYPE_PROFILE",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const data = res.ok ? ((await res.json()) as PeopleResponse) : {};

    // Employee ID: prefer the directory-search profile, fall back to people/me.
    const dirPerson = await fetchDirectoryPerson(accessToken, email ?? "");
    const employeeId = (dirPerson && extractEmployeeId(dirPerson)) || extractEmployeeId(data);
    const raw = { employeeId: employeeId ?? "NONE", me: data, dir: dirPerson ?? "no-directory-result" };
    // TEMP: expose on a global so it can be read with a single console command.
    try { (globalThis as unknown as { __DIR_DEBUG__?: unknown }).__DIR_DEBUG__ = raw; } catch { /* noop */ }

    const candidates = [
      ...(data.organizations ?? []).flatMap((o) => [o.title, o.department, o.name]),
      ...(data.occupations ?? []).map((o) => o.value),
      ...(dirPerson?.organizations ?? []).flatMap((o) => [o.title, o.department, o.name]),
    ].filter(Boolean) as string[];
    let course: { code: string; name: string } | null = null;
    for (const candidate of candidates) {
      const resolved = resolveCourse(candidate);
      if (resolved && resolved.code) { course = resolved; break; } // a recognised code wins
    }
    if (!course && candidates.length) course = resolveCourse(candidates[0]);
    return { course, employeeId, raw };
  } catch {
    return empty;
  }
}
