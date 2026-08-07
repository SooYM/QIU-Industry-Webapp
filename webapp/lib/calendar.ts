import type { EventItem } from "./data/types.ts";
import { eventSpeakers } from "./data/types.ts";

function formatDateForCalendar(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/-|:|\.\d\d\d/g, "");
}

/** A calendar entry from anywhere in the portal — a talk, a booked interview. */
export type CalendarEntry = {
  title: string;
  details?: string;
  location?: string;
  /** Local datetime strings, e.g. "2026-09-01T14:00". */
  startAt: string;
  endAt: string;
};

export function googleCalendarUrl(entry: CalendarEntry): string {
  const start = formatDateForCalendar(entry.startAt);
  const end = formatDateForCalendar(entry.endAt);
  const title = encodeURIComponent(entry.title);
  const details = encodeURIComponent(entry.details ?? "");
  const location = encodeURIComponent(entry.location || "QIU Campus");

  const datesParam = start && end ? `&dates=${start}/${end}` : "";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}${datesParam}`;
}

export function generateGoogleCalendarUrl(event: EventItem): string {
  const speakers = eventSpeakers(event).map((s) => s.name).filter(Boolean).join(", ");
  return googleCalendarUrl({
    title: event.title,
    details: `${event.description || ""}\n\nSpeaker(s): ${speakers || "TBA"}\nOrganized by QIU Industry Day 2026`,
    location: event.location,
    startAt: event.startAt,
    endAt: event.endAt,
  });
}

/** A booked mock interview / consultancy slot, for the student's own calendar. */
export function interviewCalendarUrl(slot: {
  companyName: string; date: string; startTime: string; endTime: string; location?: string;
}, sessionType: "interview" | "consultancy"): string {
  const kind = sessionType === "consultancy" ? "Consultancy" : "Mock interview";
  return googleCalendarUrl({
    title: `${kind} — ${slot.companyName}`,
    details: `${kind} with ${slot.companyName} at QIU Industry Day 2026.\n\nBring a copy of your resume and arrive a few minutes early.`,
    location: slot.location,
    startAt: `${slot.date}T${slot.startTime}`,
    endAt: `${slot.date}T${slot.endTime}`,
  });
}

export function downloadIcsFile(event: EventItem): void {
  const start = formatDateForCalendar(event.startAt);
  const end = formatDateForCalendar(event.endAt);
  const speakers = eventSpeakers(event).map((s) => s.name).filter(Boolean).join(", ");

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QIU Industry Day 2026//Event Reminder//EN",
    "BEGIN:VEVENT",
    `DTSTAMP:${formatDateForCalendar(new Date().toISOString())}`,
    `SUMMARY:${event.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${(event.description || "").replace(/\n/g, "\\n")}\\n\\nSpeaker(s): ${speakers || "TBA"}`,
    `LOCATION:${(event.location || "QIU Campus").replace(/\n/g, " ")}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `UID:qiu-event-${event.id}@industryday2026.qiu.edu.my`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `event-${event.id}-reminder.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
