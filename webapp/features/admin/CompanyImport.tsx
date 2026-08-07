import { useEffect, useState } from "react";
import type { Company } from "../../lib/data/types";
import { saveCompany, subscribeCompanies } from "../../lib/data/firestore";
import { companyNamesMatch } from "../../lib/data/company-matching";
import { notify } from "../../components/toast";

/** One row of the parse result, so problems are reported per company, not as one failure. */
type Parsed = {
  index: number;
  name: string;
  company?: Company;
  existingId?: number;
  problem?: string;
};

const SAMPLE = `[
  {
    "name": "Acme Solutions Sdn Bhd",
    "email": "hr@acme.com",
    "website": "https://acme.com",
    "logoUrl": "https://acme.com/logo.png",
    "videoUrl": "https://youtube.com/watch?v=…",
    "boothNumber": "A10",
    "summary": "What the company does, shown on the Home page."
  }
]`;

/**
 * Bulk-creates or updates exhibitor profiles from JSON.
 *
 * Import is per-row rather than all-or-nothing: with thirty companies pasted in,
 * one bad URL should not discard the other twenty-nine. Rows are matched against
 * existing companies by the same fuzzy name rule used everywhere else, so
 * re-importing a corrected file updates rather than duplicates.
 */
export function CompanyImport({ adminEmail }: { adminEmail: string }) {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<Parsed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [existing, setExisting] = useState<Company[]>([]);

  useEffect(() => subscribeCompanies(setExisting, () => {}), []);

  const str = (value: unknown, max: number) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

  const parse = () => {
    setError("");
    setResult("");
    setRows(null);
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (err: unknown) {
      setError(`That is not valid JSON: ${err instanceof Error ? err.message : "parse failed"}`);
      return;
    }
    if (!Array.isArray(data)) {
      setError("The top level must be an array of company objects — see the example below.");
      return;
    }
    if (data.length > 200) {
      setError(`That file has ${data.length} entries. Import at most 200 at a time.`);
      return;
    }

    const seen = new Set<string>();
    const parsed: Parsed[] = data.map((entry, index) => {
      const record = (entry ?? {}) as Record<string, unknown>;
      const name = str(record.name, 200);
      if (!name) return { index, name: "(unnamed)", problem: "Missing \"name\"." };

      const key = name.toLowerCase();
      if (seen.has(key)) return { index, name, problem: "Duplicate of an earlier row in this file." };
      seen.add(key);

      const match = existing.find((c) => companyNamesMatch(c.name, name));
      const company: Company = {
        // Reusing the matched id turns a re-import into an update instead of a
        // second profile with the same name.
        id: match?.id ?? Date.now() + index,
        name,
        ...(str(record.email, 254) ? { email: str(record.email, 254) } : {}),
        ...(str(record.website, 2048) ? { website: str(record.website, 2048) } : {}),
        ...(str(record.logoUrl, 2048) ? { logoUrl: str(record.logoUrl, 2048) } : {}),
        ...(str(record.videoUrl, 2048) ? { videoUrl: str(record.videoUrl, 2048) } : {}),
        ...(str(record.summary, 5000) ? { summary: str(record.summary, 5000) } : {}),
        ...(str(record.boothNumber, 40) ? { boothNumber: str(record.boothNumber, 40) } : {}),
        status: "approved",
      };
      return { index, name, company, existingId: match?.id };
    });
    setRows(parsed);
  };

  const runImport = async () => {
    if (!rows) return;
    setBusy(true);
    setError("");
    let created = 0;
    let updated = 0;
    const failures: string[] = [];

    for (const row of rows) {
      if (!row.company) continue;
      try {
        await saveCompany(row.company, Boolean(row.existingId), adminEmail);
        if (row.existingId) updated += 1; else created += 1;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code ?? "";
        failures.push(`${row.name}${code ? ` (${code})` : ""}`);
      }
    }

    setBusy(false);
    const summary = `Imported: ${created} created, ${updated} updated${failures.length ? `, ${failures.length} failed` : ""}.`;
    setResult(failures.length ? `${summary} Failed: ${failures.join(", ")}` : summary);
    notify(summary, failures.length ? "error" : "info");
    if (!failures.length) { setRaw(""); setRows(null); }
  };

  const valid = rows?.filter((r) => r.company) ?? [];
  const invalid = rows?.filter((r) => r.problem) ?? [];

  return (
    <section className="local-jobs" aria-labelledby="company-import-title">
      <div className="local-jobs-head">
        <div><span className="detail-label">BULK IMPORT</span><h3 id="company-import-title">Import company profiles from JSON</h3></div>
      </div>
      <p className="admin-intro">
        Paste an array of company objects. Existing companies are matched by name and updated, so you can
        re-import a corrected file without creating duplicates. Only <code>name</code> is required.
      </p>

      {error && <div className="p-3 text-sm ui-note-danger">{error}</div>}
      {result && <div className="p-3 text-sm ui-note-success">{result}</div>}

      <label className="register-field">
        Company JSON
        <textarea
          rows={10}
          value={raw}
          onChange={(e) => { setRaw(e.target.value); setRows(null); }}
          placeholder={SAMPLE}
          spellCheck={false}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="admin-button" onClick={parse} disabled={!raw.trim() || busy}>Check file</button>
        <button type="button" className="save-job" onClick={runImport} disabled={!valid.length || busy}>
          {busy ? "Importing…" : `Import ${valid.length} compan${valid.length === 1 ? "y" : "ies"}`}
        </button>
        <button type="button" className="admin-button" onClick={() => setRaw(SAMPLE)} disabled={busy}>Insert example</button>
      </div>

      {rows && (
        <div className="local-job-list mt-3">
          {rows.map((row) => (
            <div className="local-job" key={row.index}>
              <span>
                <b>{row.name}</b>
                <small>
                  {row.problem
                    ? `Row ${row.index + 1} — skipped: ${row.problem}`
                    : row.existingId
                      ? `Row ${row.index + 1} — updates the existing profile`
                      : `Row ${row.index + 1} — creates a new profile`}
                </small>
              </span>
            </div>
          ))}
          {invalid.length > 0 && (
            <p className="dashboard-note">
              {invalid.length} row{invalid.length === 1 ? "" : "s"} will be skipped. The rest still import.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
