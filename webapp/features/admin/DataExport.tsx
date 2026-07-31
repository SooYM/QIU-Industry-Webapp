import { useEffect, useState } from "react";
import { subscribeCompanies, subscribeEvents, subscribeVacancies } from "../../lib/data/firestore";
import type { Company, EventItem, Job } from "../../lib/data/types";
import { csvWhen, downloadCsv, toCsv } from "../../lib/data/csv";
import { notify } from "../../components/toast";

const today = () => new Date().toISOString().slice(0, 10);

/** Admin data export — pulls the live collections into downloadable CSV files.
 *  Firestore has no built-in export on the free plan, so this is the backup path. */
export function DataExport() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => subscribeVacancies(setJobs, () => {}), []);
  useEffect(() => subscribeCompanies(setCompanies, () => {}), []);
  useEffect(() => subscribeEvents(setEvents), []);

  function exportVacancies() {
    if (!jobs.length) { notify("No vacancies to export.", "error"); return; }
    const rows = jobs.map((j) => [j.title, j.company, j.type, j.specialization, j.location, j.salary, j.vacancies, j.minimumRequirement, j.email ?? "", j.status ?? "approved", j.createdBy ?? ""]);
    downloadCsv(`vacancies-${today()}.csv`, toCsv(["Title", "Company", "Type", "Specialization", "Location", "Salary (RM)", "Places", "Min. requirement", "Enquiry email", "Status", "Created by"], rows));
    notify(`Exported ${jobs.length} vacancies.`);
  }
  function exportCompanies() {
    if (!companies.length) { notify("No companies to export.", "error"); return; }
    const rows = companies.map((c) => [c.name, c.boothNumber ?? "", c.website ?? "", c.videoUrl ?? "", c.status ?? "approved", c.createdBy ?? "", (c.summary ?? "").replace(/\s+/g, " ").trim()]);
    downloadCsv(`companies-${today()}.csv`, toCsv(["Company", "Booth", "Website", "Video", "Status", "Created by", "Summary"], rows));
    notify(`Exported ${companies.length} companies.`);
  }
  function exportEvents() {
    if (!events.length) { notify("No events to export.", "error"); return; }
    const rows = events.map((e) => [e.title, e.speakerName, Array.isArray(e.specializations) ? e.specializations.join("; ") : (e.specialization ?? ""), e.location, e.startAt, e.endAt, e.sessionMinutes, csvWhen((e as { createdAt?: unknown }).createdAt)]);
    downloadCsv(`events-${today()}.csv`, toCsv(["Title", "Speaker(s)", "Specialization(s)", "Location", "Starts", "Ends", "Minutes", "Created at"], rows));
    notify(`Exported ${events.length} events.`);
  }

  return (
    <div className="data-export">
      <div className="section-heading"><div><span>DATA EXPORT</span><h3>Download portal data (CSV)</h3></div></div>
      <p>Export the live records to spreadsheet files for reporting or backup.</p>
      <div className="export-buttons">
        <button type="button" className="admin-button" onClick={exportVacancies}>⬇ Vacancies <small>({jobs.length})</small></button>
        <button type="button" className="admin-button" onClick={exportCompanies}>⬇ Company profiles <small>({companies.length})</small></button>
        <button type="button" className="admin-button" onClick={exportEvents}>⬇ Events <small>({events.length})</small></button>
      </div>
      <p className="field-label mt-2">Student applications, view history and chats export from their own tabs (Activity &amp; Chats).</p>
    </div>
  );
}
