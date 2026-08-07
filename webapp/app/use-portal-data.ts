import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { canManageVacancies, type UserRole } from "./auth-policy";
import { db } from "./firebase-client";
import {
  countEventInterests, DEFAULT_SETTINGS, subscribeApplications, subscribeAttendance, subscribeCompanies,
  subscribeEvents, subscribeJobStats, subscribeMyEventInterests, subscribeMyResume, subscribeSettings,
  subscribeVacancies, subscribeViews,
} from "../lib/data/firestore";
import type {
  AppSettings, Application, Attendance, Company, EventItem, Job, Resume, ViewEvent,
} from "../lib/data/types";

/**
 * Every live Firestore stream the portal page reads, in one place.
 *
 * This exists so a new developer can answer "what data does this app subscribe
 * to, and who is allowed to see it?" without reading the 500-line page
 * component. The role gating lives here too: student-only streams are simply
 * never opened for a manager, rather than opened and filtered in the UI.
 */
export function usePortalData(user: User | null, role: UserRole | null) {
  const [customJobs, setCustomJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [myApplications, setMyApplications] = useState<Application[]>([]);
  const [myViews, setMyViews] = useState<ViewEvent[]>([]);
  const [myResume, setMyResume] = useState<Resume | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [myInterests, setMyInterests] = useState<Record<number, boolean>>({});
  const [events, setEvents] = useState<EventItem[]>([]);
  const [myAttendance, setMyAttendance] = useState<Attendance[]>([]);
  const [jobStats, setJobStats] = useState<Record<number, number>>({});
  const [exhibitors, setExhibitors] = useState<Company[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [interestCounts, setInterestCounts] = useState<Record<number, number>>({});
  const [interestEpoch, setInterestEpoch] = useState(0);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeVacancies(
      (jobs) => { setCustomJobs(jobs); setJobsLoading(false); },
      () => setJobsLoading(false),
    );
  }, [user]);

  // Student history + resume streams (their own records only).
  useEffect(() => {
    if (!user || !db || canManageVacancies(role)) return;
    const unsubs = [
      subscribeApplications(setMyApplications, user.uid),
      subscribeViews(setMyViews, user.uid),
      subscribeMyResume(user.uid, (r) => { setMyResume(r); setResumeChecked(true); }),
      subscribeMyEventInterests(user.uid, setMyInterests),
    ];
    return () => unsubs.forEach((off) => off());
  }, [user, role]);

  // Events, exhibitors, settings (all roles) + this account's own attendance.
  useEffect(() => {
    if (!user || !db) return;
    const unsubs = [
      subscribeEvents(setEvents, () => {}),
      subscribeAttendance(setMyAttendance, user.uid),
      subscribeJobStats(setJobStats),
      subscribeCompanies(setExhibitors, () => {}),
      subscribeSettings(setSettings),
    ];
    return () => unsubs.forEach((off) => off());
  }, [user]);

  // Interested tallies are COUNTED server-side for the events on screen, not
  // streamed: a live subscription would push every student's interest doc to
  // every client. `refreshInterestCounts` re-runs it after this student taps.
  useEffect(() => {
    if (!user || !events.length) return;
    let live = true;
    countEventInterests(events.map((e) => e.id))
      .then((counts) => { if (live) setInterestCounts(counts); })
      .catch(() => { /* The tally is cosmetic; a failure must not break the page. */ });
    return () => { live = false; };
  }, [user, events, interestEpoch]);

  const refreshInterestCounts = useCallback(() => setInterestEpoch((n) => n + 1), []);

  return {
    customJobs, jobsLoading, myApplications, myViews, myResume, resumeChecked, myInterests,
    events, myAttendance, jobStats, exhibitors, settings, interestCounts, refreshInterestCounts,
  };
}
