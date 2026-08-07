// Barrel for the Firestore access layer — the single integration seam between
// the UI and the database. Feature modules import from here and never touch the
// Firestore SDK directly, so swapping backends means reimplementing this folder
// and nothing else.
//
// The implementation is split by domain; open the module you need:
//   client.ts      connection plumbing, COLLECTIONS, DEFAULT_SETTINGS
//   vacancies.ts   vacancies, applications, view history, resumes
//   events.ts      talks, attendance codes, interest, live Q&A, reviews
//   interviews.ts  mock interview slots and bookings
//   companies.ts   exhibitor profiles and profile-visit logging
//   employers.ts   employer self-registration, access revocation, data reset
//   settings.ts    the runtime settings document
//   chat-logs.ts   persisted assistant turns
export * from "./client";
export * from "./vacancies";
export * from "./chat-logs";
export * from "./events";
export * from "./companies";
export * from "./settings";
export * from "./employers";
export * from "./interviews";
