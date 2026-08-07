import type { EventItem } from "./data/types.ts";
import { eventSpeakers } from "./data/types.ts";

function formatDateForCalendar(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/-|:|\.\d\d\d/g, "");
}

export function generateGoogleCalendarUrl(event: EventItem): string {
  const start = formatDateForCalendar(event.startAt);
  const end = formatDateForCalendar(event.endAt);
  const speakers = eventSpeakers(event).map((s) => s.name).filter(Boolean).join(", ");

  const title = encodeURIComponent(event.title);
  const details = encodeURIComponent(
    `${event.description || ""}\n\nSpeaker(s): ${speakers || "TBA"}\nOrganized by QIU Industry Day 2026`,
  );
  const location = encodeURIComponent(event.location || "QIU Campus");

  const datesParam = start && end ? `&dates=${start}/${end}` : "";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}${datesParam}`;
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
