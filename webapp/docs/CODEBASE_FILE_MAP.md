# QIU Industry Webapp — Exhaustive Codebase File Map & Technical Specification

> [!NOTE]
> **Status:** Active Internal Testing Phase — Currently undergoing internal validation. Live deployment links and public hosting URLs are strictly withheld during testing.

This document serves as the authoritative, file-by-file technical reference for the **QIU Industry Webapp**. It covers **every single source, component, domain model, security rule, configuration, script, and test suite file** in the project. For each file, this spec documents its exact relative path, primary purpose, architectural role, exported symbols (components, hooks, functions, interfaces, types), and a detailed code block breakdown explaining internal state, logic flows, and side-effects.

---

## Technical Documentation Index

1. [Application Shell & Setup (`webapp/app/`)](#1-application-shell--setup-webappapp)
2. [Reusable UI Components (`webapp/components/`)](#2-reusable-ui-components-webappcomponents)
3. [Feature Modules (`webapp/features/`)](#3-feature-modules-webappfeatures)
   - [3.1 Role Guide (`Guide.tsx`)](#31-role-guide-guidetsex)
   - [3.2 Home Subsystem (`features/home/`)](#32-home-subsystem-featureshome)
   - [3.3 Vacancies Subsystem (`features/vacancies/`)](#33-vacancies-subsystem-featuresvacancies)
   - [3.4 Admin Subsystem (`features/admin/`)](#34-admin-subsystem-featuresadmin)
   - [3.5 Student Subsystem (`features/student/`)](#35-student-subsystem-featuresstudent)
   - [3.6 Events & Anti-Cheat Subsystem (`features/events/`)](#36-events--anti-cheat-subsystem-featuresevents)
   - [3.7 Grounded Assistant Subsystem (`features/chat/`)](#37-grounded-assistant-subsystem-featureschat)
4. [Data & Domain Layer (`webapp/lib/`)](#4-data--domain-layer-webapplib)
5. [Security Rules, Scripts & Build Configurations](#5-security-rules-scripts--build-configurations)
6. [Automated Test Suites (`webapp/tests/`)](#6-automated-test-suites-webapptests)

---

## 1. Application Shell & Setup (`webapp/app/`)

### 1.1 [layout.tsx](../app/layout.tsx)
- **Main Purpose & Architectural Role**: Serves as the root Next.js App Router layout file. Wraps the whole DOM tree with the global `<AuthProvider>`, `<AuthGate>`, and the global `<Toaster>` notification container. Sets up font variables (`--font-geist-sans`, `--font-geist-mono`) and imports `globals.css`.
- **Exported Symbols**: `metadata: Metadata` (default metadata export), `default RootLayout({ children })` (React Server Component layout).
- **Detailed Code Block Breakdown**:
  - `geistSans` / `geistMono`: Font variable definitions configuring CSS custom properties for Geist sans and mono fonts.
  - `metadata`: Exported Next.js page metadata object establishing portal page title (*"QIU Industry Day 2026"*), meta description, OpenGraph tags, Twitter card configuration, and SVG favicon links.
  - `RootLayout`: Default exported functional component rendering `<html>` with language `en-MY`, `<body>` styled with antialiased font classes, wrapping `children` inside `<AuthProvider>` and `<AuthGate>`, followed by the global `<Toaster />` mount point.

### 1.2 [page.tsx](../app/page.tsx)
- **Main Purpose & Architectural Role**: The central state orchestrator and primary entry page for the application shell. Manages tab selection (`summary`, `home`, `vacancies`, `history`, `resume`, `events`, `dashboard`), reactive Firestore subscriptions (`subscribeVacancies`, `subscribeApplications`, `subscribeViews`, `subscribeMyResume`, `subscribeEvents`, `subscribeAttendance`, `subscribeJobStats`, `subscribeCompanies`, `subscribeSettings`), multi-criteria vacancy search/sort/filter state, URL query parameter anti-cheat QR auto-check-in parsing, dynamic layout preferences, and modal dialog mount states.
- **Exported Symbols**: `default Home()` (Client Component page).
- **Detailed Code Block Breakdown**:
  - **State Declarations** (`L32-L64`): Manages custom job list (`customJobs`), current active tab (`tab`), student application feed (`myApplications`), view logs (`myViews`), resume document (`myResume`), real-time job filters (`query`, `company`, `specialization`, `type`, `maxSalary`), layout parameters (`columns`, `vacancyView`, `theme`), modal toggles (`selectedJob`, `selectedEvent`, `guideOpen`, `mobileFiltersOpen`), sorting (`sort`), recommendation filter (`recommendationMode`), event schedule (`events`), personal attendance (`myAttendance`), public applicant tallies (`jobStats`), exhibitor list (`exhibitors`), and portal settings (`settings`).
  - **Preference Hydration Effect** (`L65-L75`): Reads `PREFS_KEY` from `localStorage` on client mount to restore per-page counts, column counts, text scaling, and theme without server SSR mismatch.
  - **Firestore Data Subscriptions** (`L77-L105`): Initializes real-time `onSnapshot` listeners for `vacancies`, candidate applications, views, user resume, events, attendance records, atomic applicant tallies (`jobStats`), companies, and app settings. Unsubscribes cleanly on unmount or user change.
  - **Attendance QR Auto-Scan Handler** (`L108-L135`): Inspects window location query parameters (`?ev=&s=&c=`). If present, parses event ID, step (`checkin` or `checkout`), and code, executes `checkInAttendance` or `checkOutAttendance`, updates `scanMsg` feedback toast, clears URL via `window.history.replaceState`, and switches active tab to `"events"`.
  - **Document & DOM Effects** (`L137-L189`): Synchronizes document title with `settings.portalTitle`, toggles `data-theme` and `dark` class on `document.documentElement`, handles Escape key listener to close active modals, and applies body overflow lock (`overflow: hidden`) with scrollbar width compensation when modals are active.
  - **Tab & Filter Derivations** (`L197-L255`): Computes `visibleTabs` based on user role (`user`, `employer`, `admin`, `superadmin`) and `settings.tabs` toggles. Filters `jobs` based on approval status (students see approved vacancies only; managers see all), program course match (`jobMatchesCourse`), text search query, specialization, type, salary range, and sort order (`default`, `newest`, `oldest`, `salary_high`, `salary_low`).
  - **Action Handlers** (`L260-L285`): Defines `applyToJob` (invokes `recordApplication`), `withdrawFromJob` (invokes `deleteApplication`), and `glow` (sets CSS mouse coordinates `--mouse-x` / `--mouse-y` for card highlight effects).
  - **JSX Render Layout** (`L295-L447`): Renders topbar header with brand logo, guide button, theme toggle, and `<AuthAccount />`, scan feedback banner, navigation utility tab bar, main tab workspace views (`<HomeView>`, `<VacancyFilters>`, `<VacancyList>`, `<StudentHistory>`, `<StudentResume>`, `<EventsView>`, `<AdminPanel>`, `<AdminSummary>`, `<EmployerSummary>`), footer, and modal overlays (`<VacancyModal>`, `<EventDetail>`, `<Guide>`).

### 1.3 [auth-context.tsx](../app/auth-context.tsx)
- **Main Purpose & Architectural Role**: Provides global authentication context using Firebase Authentication Google Provider and Cloud Firestore user profile records. Enforces institutional domain restrictions (`@qiu.edu.my`), pre-whitelisted external employer accounts (`whitelisted_emails`), incremental Google People API directory course auto-resolution for students, external company self-registration gate (`RegisterGate`), and administrative role promotion UI (`RoleManager`).
- **Exported Symbols**: `AuthProvider({ children })`, `useAuth()`, `AuthGate({ children })`, `AuthAccount()`, `RoleManager()`, `type UserRole`.
- **Detailed Code Block Breakdown**:
  - `GoogleAuthProvider` Setup (`L61-L63`): Configures Firebase Google Provider with `prompt: "select_account"` without sensitive scopes to prevent unverified app consent warnings for non-QIU visitors.
  - `AuthProvider` Component (`L76-L235`): Listens to `onAuthStateChanged`. Validates email verification (`nextUser.emailVerified`), checks whitelist status (`isAllowedAccessEmail`), fetches user profile from `users/{uid}` and whitelist doc from `whitelisted_emails/{email}`, resolves role via `roleForEmail`, and persists user role, course, and company state.
  - `signIn` & `signOut` Functions (`L196-L232`): `signIn` executes `signInWithPopup`. For `@qiu.edu.my` accounts, incrementally requests `PEOPLE_SCOPE` via `reauthenticateWithPopup` to query the Google Workspace directory (`fetchDirectoryCourse`), saving the resolved course code and name to `users/{uid}`.
  - `AuthGate` Component (`L243-L260`): Gates main app content behind sign-in. Shows `AuthStatus` checking loader while loading, renders Google sign-in screen when unauthenticated, redirects non-QIU unapproved visitors to `<RegisterGate />`, or renders `children` when authenticated.
  - `RegisterGate` Component (`L263-L325`): Self-service registration form for external non-QIU partner employers. Allows entering company name, contact, website, logo URL (with Clearbit auto-fetch button), corporate video link, and summary. Submits to `employer_signups/{email}` via `submitSignup` and displays pending queue message.
  - `AuthAccount` Component (`L334-L349`): Renders user profile pill in the header with avatar photo/initials, display name/email, assigned role/course badge, and sign-out button.
  - `RoleManager` Component (`L351-L524`): Administrative access control panel. Queries `users` and `whitelisted_emails` collections. Allows superadmin and admins to change user roles (`assignRole`), whitelist external non-QIU email addresses (`addWhitelistedEmail`), assign employer company scopes, and revoke whitelisted access (`removeWhitelistedEmail`).

### 1.4 [auth-policy.ts](../app/auth-policy.ts)
- **Main Purpose & Architectural Role**: Central policy helper file defining security rules logic, role verification functions, email normalization utilities, logo URL auto-fetching via Clearbit, and YouTube embed URL transformers.
- **Exported Symbols**: `UserRole`, `SUPERADMIN_EMAIL`, `DEFAULT_YOUTUBE_PLACEHOLDER`, `normalizeEmail(email)`, `isAllowedQiuEmail(email)`, `isAllowedAccessEmail(email, whitelistedEmails)`, `roleForEmail(email, storedRole)`, `canManageVacancies(role)`, `canEditOrDeleteJob(job, currentUserEmail, role)`, `logoFromWebsite(url)`, `getYouTubeEmbedUrl(url)`.
- **Detailed Code Block Breakdown**:
  - `normalizeEmail` (`L6-L8`): Trims and lowercases raw email strings.
  - `isAllowedQiuEmail` (`L10-L13`): Asserts that email domain ends with `qiu.edu.my`.
  - `isAllowedAccessEmail` (`L15-L20`): Validates access if email is `@qiu.edu.my` OR present in `whitelistedEmails`.
  - `roleForEmail` (`L22-L27`): Returns `"superadmin"` for `ai@qiu.edu.my`, else checks stored role for `"admin"` or `"employer"`, defaulting to `"user"`.
  - `canManageVacancies` (`L29-L31`): Evaluates whether a role is `"admin"`, `"superadmin"`, or `"employer"`.
  - `canEditOrDeleteJob` (`L33-L41`): Grants edit rights to admins/superadmin unconditionally, and to employers if they created the job (`job.createdBy === currentUserEmail`).
  - `logoFromWebsite` (`L44-L50`): Extracts clean domain hostname from a website URL and formats Clearbit logo API URL (`https://logo.clearbit.com/{host}`).
  - `getYouTubeEmbedUrl` (`L52-L71`): Parses YouTube watch links (`watch?v=`), short links (`youtu.be/`), or embed links (`embed/`), extracting the 11-character video ID and returning `https://www.youtube.com/embed/{videoId}`.

### 1.5 [firebase-client.ts](../app/firebase-client.ts)
- **Main Purpose & Architectural Role**: Initializes Firebase JavaScript SDK v12 services (Authentication, Firestore, Storage) using client-side environment variables (`NEXT_PUBLIC_FIREBASE_*`). Sets auth session persistence to `browserLocalPersistence` to survive cross-site storage partitioning.
- **Exported Symbols**: `isFirebaseConfigured`, `firebaseApp`, `auth`, `db`, `storage`.
- **Detailed Code Block Breakdown**:
  - `firebaseConfig`: Reads environment variables (`NEXT_PUBLIC_FIREBASE_API_KEY`, `PROJECT_ID`, `STORAGE_BUCKET`, etc.).
  - `isFirebaseConfigured`: Boolean flag checking if all required config values are non-empty.
  - `firebaseApp`: Singleton Firebase app instance initialized via `initializeApp` or reused via `getApp()`.
  - `auth`: `getAuth(firebaseApp)` instance configured with `setPersistence(auth, browserLocalPersistence)`.
  - `db`: `getFirestore(firebaseApp)` Cloud Firestore database reference.
  - `storage`: `getStorage(firebaseApp)` Firebase Storage bucket reference.

### 1.6 [globals.css](../app/globals.css)
- **Main Purpose & Architectural Role**: Primary application stylesheet implementing Tailwind CSS v4 directives (`@import "tailwindcss"`), design token maps (`@import "../lib/theme/tokens.css"`), Signature QIU-Red brand layout styles, interactive card glow animations (`--mouse-x`, `--mouse-y`), Applied rubber stamp graphics, presenter QR screens, print media overrides (`@media print`), and responsive grid layouts.
- **Exported Symbols**: Global CSS file (imported in `layout.tsx`).
- **Detailed Code Block Breakdown**:
  - `@import` Statements: Integrates Tailwind CSS v4, font definitions, and token custom properties.
  - Base Layout Styles: Resets HTML/body elements, configures light default background (`var(--color-page)`), typography line heights, and dark theme attributes (`[data-theme="dark"]`).
  - Brand Components: Styles topbar `.topbar`, brand logo `.brand-logo` (with dark-mode inversion `filter: invert(1)`), utility tabs `.main-tabs`, vacancy grid `.job-grid`, vacancy cards `.job-card`, applied stamp overlay `.applied-stamp`, modal dialogs `.job-detail`, event presenter `.event-presenter`, and toast stack `.toast-stack`.
  - Print Media Rules (`@media print`): Hides header, navigation, buttons, and footers during printing, transforming `<GeneratedCV>` sheets into high-contrast PDF print outputs.

### 1.7 [RichText.tsx](../app/RichText.tsx)
- **Main Purpose & Architectural Role**: Markdown text parsing component for rendering formatted AI assistant messages, RAG responses, and vacancy knowledge snippets. Supports headers (`#`, `##`, `###`), bold (`**`), italic (`*`), code inline blocks (`` ` ``), bullet lists (`•`, `-`), and SLM-Lite badge tags safely without `dangerouslySetInnerHTML`.
- **Exported Symbols**: `RichText({ content, className })`.
- **Detailed Code Block Breakdown**:
  - `blocks`: Splits input string by double newlines (`\n\n`) into separate structural paragraphs or list blocks.
  - `formatInline` Helper (`L15-L42`): Tokenizes inline text using regex `(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|⚡\s\*?[^*]+\*?)`. Converts bold tokens into `<strong>`, italic tokens into `<em>`, code tokens into `<code>`, and SLM badge tokens into stylized `<span>` pills.
  - Block Parser Loop (`L44-L105`): Iterates over text blocks. Maps `### ` to `<h3>`, `## ` to `<h2>`, `# ` to `<h1>`, list lines to `<ul><li>`, and standard text blocks to `<p>` elements with `<br />` linebreaks.

### 1.8 [chat.ts](../app/chat.ts)
- **Main Purpose & Architectural Role**: Core RAG (Retrieval-Augmented Generation) lexical search engine. Performs keyword tokenization, stop-word filtering, word-boundary regex matching, domain-specific study area boosting (computing, software, culinary, F&B, accounting), internship type matching, and salary threshold scoring to retrieve matching vacancies for the AI assistant.
- **Exported Symbols**: `JobRecord`, `retrieveJobs(question, jobs)`, `answerFromJobs(question, jobs)`.
- **Detailed Code Block Breakdown**:
  - `stopWords` (`L21-L27`): Comprehensive `Set` of English noise words filtered out during query tokenization.
  - `tokens` (`L29-L35`): Normalizes query text, strips non-alphanumeric characters, splits into words, and excludes stop-words.
  - Domain Detectors (`L37-L43`): `isComputingStudyArea` and `isCulinaryStudyArea` regex helpers detecting specialized academic query fields.
  - `retrieveJobs` (`L45-L106`): Scores every vacancy against query tokens using word-boundary regexes (`\btoken\b`). Awards +6 for title match, +5 for specialization match, +4 for company match, +3 for location, +2 for requirements. Adds domain knowledge boosts (+14 for software engineering, +16 for culinary F&B, +8 for internships, +6 for salary ranges). Filters for score $\ge 4$, sorts descending, and returns top 8 matches.
  - `answerFromJobs` (`L108-L110`): Delegates prompt and retrieved candidates to `generateSlmResponse`.

### 1.9 [slm-engine.ts](../app/slm-engine.ts)
- **Main Purpose & Architectural Role**: Client-side Small Language Model (SLM) AI Engine (**SLM-Lite v1.0**). Implements intent extraction, out-of-domain query rejection, salary benchmark analysis, conversational intents (greetings, time/date), RAG search integration, and citation grounding.
- **Exported Symbols**: `SlmModelMeta`, `SLM_MODEL_INFO`, `SlmIntent`, `SlmExtractedIntent`, `extractSlmIntent(prompt)`, `generateSlmResponse(prompt, jobs)`.
- **Detailed Code Block Breakdown**:
  - `SLM_MODEL_INFO` (`L21-L28`): Metadata object specifying model name (`"SLM-Lite"`), version (`"v1.0"`), parameters (`"135M"`), mode (`"Browser-On-Device"`), and context window (`4096`).
  - `extractSlmIntent` (`L52-L89`): Evaluates regex patterns against user prompt to extract intent category: `TIME_DATE`, `GREETING`, `OUT_OF_DOMAIN` (rejection for recipes, sports, trivia, math, entertainment), `SALARY_COMPARISON`, `INTERNSHIP_SEARCH`, `ACADEMIC_MATCH`, or `VACANCY_SEARCH`.
  - `generateSlmResponse` (`L94-L171`): Generates structured response object `{ answer, sources, modelInfo }`. Rejects `OUT_OF_DOMAIN` queries with helpful scope guidance. Synthesizes dynamic responses for `TIME_DATE` (current local time/date), `GREETING` (capability summary), and `SALARY_COMPARISON` (sorts jobs by salary and lists top benchmarks). For vacancy searches, calls `retrieveJobs` and formats candidate listings with citation tags.

### 1.10 [map-tooltip.ts](../app/map-tooltip.ts)
- **Main Purpose & Architectural Role**: Mathematical coordinate boundary positioning utility for interactive map tooltips. Prevents tooltip overflow off container edges when hovering over countries on the SVG world map.
- **Exported Symbols**: `TooltipPosition`, `positionTooltip(pointerX, pointerY, containerWidth, containerHeight, tooltipWidth, tooltipHeight, gap)`.
- **Detailed Code Block Breakdown**:
  - `preferredLeft`: Calculates left offset, flipping to the left of pointer if right edge would overflow container boundary.
  - `preferredTop`: Calculates top offset, flipping below pointer if top edge would overflow container header gap.
  - Return Calculation (`L19-L22`): Clamps calculated `left` and `top` pixel values using `Math.min` and `Math.max` to guarantee the tooltip remains entirely within container bounds.


### 1.11 [use-portal-data.ts](../app/use-portal-data.ts)
- **Main Purpose & Architectural Role**: Every live Firestore stream the portal page reads, in one hook. Exists so a new developer can answer "what does this app subscribe to, and who may see it?" without reading the page component. Role gating lives here: student-only streams are never opened for a manager, rather than opened and filtered in the UI.
- **Exported Symbols**: `usePortalData(user, role)`.
- **Returns**: `customJobs`, `jobsLoading`, `myApplications`, `myViews`, `myResume`, `resumeChecked`, `myInterests`, `events`, `myAttendance`, `jobStats`, `exhibitors`, `settings`, `interestCounts`, `refreshInterestCounts`.
- **Note**: `interestCounts` is *counted* server-side per visible event, not streamed — a live subscription over `event_interests` would push every student's document to every client. Call `refreshInterestCounts()` after a student marks or unmarks interest.

---

## 2. Reusable UI Components (`webapp/components/`)

### 2.1 [Modal.tsx](../components/Modal.tsx)
- **Main Purpose & Architectural Role**: Accessible, reusable modal dialog container component. Features backdrop click detection, ARIA dialog roles, close button, and focus management.
- **Exported Symbols**: `Modal({ className, labelledBy, closeLabel, onClose, children })`.
- **Detailed Code Block Breakdown**:
  - Outer Backdrop (`L22`): Renders `<div className="modal-backdrop">` with `onMouseDown` handler that invokes `onClose` only when click originates directly on backdrop container.
  - Dialog Panel (`L23-L27`): Renders `<section className={className}>` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby={labelledBy}`, top-right auto-focused close button (`×`), and `children`.

### 2.2 [toast.tsx](../components/toast.tsx)
- **Main Purpose & Architectural Role**: Global event-driven toast notification system. Allows firing transient visual feedback popups (`success`, `error`, `info`) from anywhere in the codebase without prop-drilling or context providers.
- **Exported Symbols**: `notify(message, kind)`, `Toaster()`.
- **Detailed Code Block Breakdown**:
  - `listeners` & `counter` (`L8-L9`): Module-level `Set<Listener>` and auto-incrementing integer ID counter.
  - `notify` Function (`L12-L15`): Global function that creates a `Toast` object `{ id, message, kind }` and broadcasts it to all registered listener callbacks.
  - `Toaster` Component (`L18-L42`): Component mounted in root layout. Registers listener effect to append new toasts to local state, setting a 3.8-second auto-dismiss timeout (`window.setTimeout`). Renders stacked toast elements with type icons (`✓`, `⚠`, `ℹ`) and manual dismiss buttons.

### 2.3 [ImagePreview.tsx](../components/ImagePreview.tsx)
- **Main Purpose & Architectural Role**: Live image URL preview component. Renders real-time image thumbnails under form input fields (such as logo and video URLs), with automatic URL regex validation and load failure warnings.
- **Exported Symbols**: `ImagePreview({ url, label })`.
- **Detailed Code Block Breakdown**:
  - `src` & `failed` State (`L10-L12`): Trims input URL and maintains boolean `failed` load state, resetting whenever `src` changes.
  - URL Validation (`L14`): Returns `null` if URL does not match HTTP/HTTPS regex `/^https?:\/\/.+/i`.
  - Render Logic (`L15-L22`): Renders preview container. Displays broken link warning (`⚠ Couldn't load this image`) if `onError` fires; otherwise renders `<img>` element.

---

## 3. Feature Modules (`webapp/features/`)

### 3.1 Role Guide (`Guide.tsx`)

#### [Guide.tsx](../features/Guide.tsx)
- **Main Purpose & Architectural Role**: Interactive multi-role onboarding guide modal accessible via the topbar `?` button. Displays customized walkthrough steps and live UI button snapshot chips for Students (8 steps), Employers (5 steps), Admins (6 steps), and Super-Admins (7 steps).
- **Exported Symbols**: `Guide({ role, onClose })`.
- **Detailed Code Block Breakdown**:
  - Helper Components (`L8-L17`): `Chip` (renders non-interactive styled button badge matching live UI design tokens) and `Demo` (wraps chips in structured preview containers).
  - `GUIDES` Spec Dictionary (`L18-L270`): Configuration dictionary establishing walkthrough headings, bullet points, and live UI button previews across four role profiles:
    - `student` (8 steps): Welcome/Tabs, Home directory exploration & `🌟 Recommended for you` tags, Resume builder options (Form CV vs shared PDF link), Vacancy filtering & `★ APPLIED` stamps, Application submission & withdrawal, Mock interview/consultancy booking with clash detection, Event attendance QR check-in/out & live Q&A & reviews, and In-modal AI Assistant.
    - `employer` (5 steps): Registration & admin approval flow, Company profile setup & staged edits, Vacancy posting with market salary benchmarks, Mock interview scheduling & candidate review, and Applicant & chat analytics.
    - `admin` (6 steps): Sub-tabs overview, Company approvals & bulk JSON import, Access control & whitelist management, Vacancy operations, Event QR presenter mode & live Q&A moderation, and Talk Q&A audit history & portal settings.
    - `superadmin` (7 steps): Inherits all Admin steps and adds Step 7: Account Roster Oversight (full active student telemetry), Danger Zone full data reset (requiring explicit `CONFIRM-RESET` text verification), and Super-Admin account immutability (cannot be demoted or deleted).
  - `Guide` Component (`L271-L292`): Resolves current role key, renders `<Modal>` with section list, bullet items, UI snapshot previews, and a *"Got it"* dismiss button.

### 3.2 Home Subsystem (`features/home/`)

#### 3.2.1 [home/HomeView.tsx](../features/home/HomeView.tsx)
- **Main Purpose & Architectural Role**: Industry Day exhibitor directory and landing showcase. Displays approved company cards, booth tags, corporate video embeds, logo backdrop luminance tiles, and an in-modal grounded single-company streaming assistant (`CompanyAssistant`).
- **Exported Symbols**: `HomeView({ companies, jobs, isStudent, course, settings, onOpenJob })`.
- **Detailed Code Block Breakdown**:
  - `answerAboutCompany` (`L13-L31`): Deterministic query answer generator grounded strictly in the selected company's profile text, booth number, website URL, corporate video link, and vacancy list.
  - `CompanyAssistant` Component (`L34-L84`): Grounded assistant scoped to a single company. Streams typewriter responses (3 characters every 16ms), auto-scrolls chat window, and logs turns to Firestore `chat_logs` via `logChat`.
  - `CompanyDetail` Modal Component (`L86-L146`): In-modal company profile viewer rendering company logo (with `useLogoBackdrop` class), booth tag, website link, corporate blurb, vacancy buttons (highlighting course matches), YouTube video iframe (`getYouTubeEmbedUrl`), and `<CompanyAssistant>`.
  - `ExhibitorCard` Component (`L148-L170`): Grid card rendering company logo (with error fallback initials), name, booth pill, summary snippet, website/video badges, and click handler.
  - `HomeView` Component (`L174-L221`): Primary landing directory component filtering approved companies (`isApprovedCompany`), rendering page header, exhibitor grid, and modal overlay.

#### 3.2.2 [home/useLogoBackdrop.ts](../features/home/useLogoBackdrop.ts)
- **Main Purpose & Architectural Role**: Custom React hook for automated logo image luminance analysis. Samples image pixels via an HTML5 2D Canvas to determine whether transparent logos require light or dark backdrop tiles for visual contrast.
- **Exported Symbols**: `useLogoBackdrop(url, mode)`.
- **Detailed Code Block Breakdown**:
  - State & Mode Evaluation (`L15-L17`): Initializes `auto` state to `"light"`. Returns static mode if `mode !== "auto"`.
  - Effect Loop (`L18-L43`): Creates `HTMLImageElement` with `crossOrigin = "anonymous"`. Draws image onto a $24 \times 24$ HTML5 Canvas. Reads pixel RGBA bytes using `getImageData`.
  - Luminance Calculation (`L32-L38`): Iterates over pixel buffer. Skips transparent pixels ($A < 24$). Computes relative luminance $Y = 0.2126R + 0.7152G + 0.0722B$.
  - Threshold Decision (`L38`): If average luminance $> 170$ (bright/white logo), sets backdrop to `"dark"`; otherwise `"light"`. Catches canvas CORS taints gracefully, falling back to `"light"`.

### 3.3 Vacancies Subsystem (`features/vacancies/`)

#### 3.3.1 [vacancies/VacancyList.tsx](../features/vacancies/VacancyList.tsx)
- **Main Purpose & Architectural Role**: Vacancy card grid container. Renders every filtered `<VacancyCard>` item plus the empty-state reset prompt.
- **Exported Symbols**: `VacancyList({ jobs, isStudent, course, appliedIds, columns, view, onGlow, onSelect, onReset })`.
- **Detailed Code Block Breakdown**:
  - Grid Render (`L35-L48`): Renders `<div className="job-grid">` with dynamic column CSS property `--columns: columns`. Maps `jobs` into `<VacancyCard>` components, evaluating course recommendations (`jobMatchesCourse`) and application status (`appliedIds.has(job.id)`).
  - Empty State (`L49-L51`): Displays empty result notice with reset button when no jobs match active filters.
  - Full Result List: Renders every vacancy matching the active filters in one continuous list or grid.

#### 3.3.2 [vacancies/VacancyCard.tsx](../features/vacancies/VacancyCard.tsx)
- **Main Purpose & Architectural Role**: Individual vacancy card component. Renders opportunity type badges, course recommendation pills, manager approval status badges, job title, company, location, salary callout, interactive mouse glow handler (`onGlow`), and applied rubber stamp SVG.
- **Exported Symbols**: `VacancyCard({ job, recommended, applied, showStatus, onGlow, onOpen })`.
- **Detailed Code Block Breakdown**:
  - Status Resolution (`L20`): Resolves manager status metadata via `jobStatusMeta(job)`.
  - Card Container (`L22`): Renders `<article className="job-card">` with recommendation/applied modifier classes, keyboard event listeners (`Enter`/`Space`), and pointer move glow handler.
  - Applied Stamp SVG (`L23-L35`): Renders circular SVG rubber stamp graphics (`APPLIED` with stars and dots) when student has applied.
  - Header & Body (`L36-L51`): Renders opportunity type pill (`Permanent`, `Internship`), recommendation badge, approval status badge, vacancies count, job title, company name, location, specialization, minimum requirement, and prominent salary callout (`formatSalary`).

#### 3.3.3 [vacancies/VacancyModal.tsx](../features/vacancies/VacancyModal.tsx)
- **Main Purpose & Architectural Role**: Comprehensive vacancy detail modal dialog. Renders job scope, requirements, listing metadata, market benchmarks, corporate YouTube videos, application consent gates, candidate applicant counts, and the single-job grounded streaming assistant (`JobAssistant`).
- **Exported Symbols**: `VacancyModal({ job, isStudent, recommended, applied, hasGeneratedResume, hasResumeLink, applicantCount, onApply, onWithdraw, onGoToResume, onClose })`.
- **Detailed Code Block Breakdown**:
  - `answerAboutJob` (`L11-L39`): Deterministic query engine answering questions strictly from the vacancy's own fields (requirements, job scope, salary, location, company, contact email, vacancies).
  - `JobAssistant` Component (`L42-L105`): In-modal AI streaming assistant scoped to a single job. Typewriter streams response text and logs turns to `chat_logs`.
  - `VacancyModal` Component (`L107-L219`): Modal overlay displaying opportunity title, salary banner, formatted job scope, requirements, listing metadata table, corporate YouTube iframe embed (`getYouTubeEmbedUrl`), contact email action, application submission choices (generated CV vs shared link), withdrawal button, applicant tally (`applicantCount`), and `<JobAssistant>`.

#### 3.3.4 [vacancies/VacancyFilters.tsx](../features/vacancies/VacancyFilters.tsx)
- **Main Purpose & Architectural Role**: Multi-criteria vacancy search and filter sidebar component. Provides text search, recommendation mode toggle, company dropdown, specialization dropdown, opportunity type dropdown, 5-mode sort dropdown, and monthly salary range slider.
- **Exported Symbols**: `VacancyFilters({ isStudent, programmeLabel, recommendationMode, onRecommendationMode, query, onQuery, company, companies, onCompany, specialization, specializations, onSpecialization, type, types, onType, maxSalary, onMaxSalary, sort, onSort, mobileFiltersOpen, onReset })`.
- **Detailed Code Block Breakdown**:
  - Student Profile Banner (`L53-L70`): Displays student's detected programme label and recommendation filter toggle (*"All vacancies"* vs *"Recommended for my profile only"*).
  - Search & Category Selectors (`L72-L75`): Renders text search input (`query`), company dropdown (`companies`), specialization dropdown (`specializations`), and opportunity type dropdown (`types`).
  - 5-Mode Sort Dropdown (`L76-L82`): Renders sort selector supporting `default` (course recommendation match), `newest`, `oldest`, `salary_high` (descending), and `salary_low` (ascending).
  - Salary Range Slider (`L83`): Range input slider controlling `maxSalary` (RM 500 to RM 10,000+).

#### 3.3.5 [vacancies/vacancy-utils.ts](../features/vacancies/vacancy-utils.ts)
- **Main Purpose & Architectural Role**: Pure utility functions, constants, data formatters, and type definitions powering vacancy listings, salary benchmarking, geographic SVG path parsing, and role description synthesis.
- **Exported Symbols**: `ChatMessage`, `Theme`, `TextScale`, `CountryShape`, `GeoFeature`, `AdminDraft`, `jobStatusMeta(job)`, `DOSM_SOURCE`, `PREFS_KEY`, `emptyDraft`, `malaysiaStates`, `malaysiaStateAliases`, `countryPath(feature)`, `salaryBenchmarks`, `formatSalary(job)`, `benchmarkFor(job)`, `roleDescription(job)`.
- **Detailed Code Block Breakdown**:
  - `jobStatusMeta` (`L25-L32`): Returns status label and CSS tone class (`Pending` -> `tone-neutral`, `Pending edit` -> `tone-accent`, `Rejected` -> `tone-danger`, `Approved` -> `tone-success`).
  - `countryPath` (`L40-L54`): Converts GeoJSON Polygon/MultiPolygon coordinates into SVG `<path>` `d` strings using Mercator-style projection scaling.
  - `salaryBenchmarks` & `benchmarkFor` (`L56-L81`): Matches vacancy titles against DOSM salary benchmark statistics (manufacturing RM 3,278, construction RM 3,035, services RM 3,831, mining RM 5,904). Computes min/max benchmark ranges ($\pm 20\%$).
  - `formatSalary` (`L66-L68`): Formats numeric salary figures into currency strings (e.g. `RM 3,500 / monthly`).
  - `roleDescription` (`L83-L95`): Synthesizes realistic role descriptions based on vacancy title and specialization.

### 3.4 Admin Subsystem (`features/admin/`)

#### 3.4.1 [admin/AdminPanel.tsx](../features/admin/AdminPanel.tsx)
- **Main Purpose & Architectural Role**: Sub-tab navigation container and vacancy management editor. Coordinates sub-tabs (`access`, `approvals`, `manageExhibitor`, `addExhibitor`, `manageVac`, `addVac`, `activity`, `resumes`, `chats`, `settings`, `company`), handles vacancy creation/editing, interactive SVG world map location picking, staged edit submission (`stageJobEdit`), and admin approval publishing (`saveJob`).
- **Exported Symbols**: `AdminPanel({ onCreated, customJobs, companies, specializations, types })`.
- **Detailed Code Block Breakdown**:
  - State & Views (`L45-L58`): Manages sub-tab view (`adminView`), form draft (`draft`), edit ID (`editingId`), search filters, and interactive GeoJSON country map boundaries (`countryShapes`, `hoveredCountry`).
  - GeoJSON Loader Effect (`L67-L76`): Fetches `/countries.geojson` to populate interactive map boundaries.
  - `saveVacancy` Handler (`L108-L200`): Validates form inputs. Resolves specialization and location (Malaysia state vs international country). Grants direct live publishing (`status: "approved"`) to admins/superadmin, or queues self-submissions (`status: "pending"`) and staged edits (`status: "pending_edit"`) for employers.
  - `removeCustomJob` & `editCustomJob` (`L202-L248`): Performs deletion via `deleteJob` and populates draft state for editing.
  - Interactive SVG Map Handlers (`L250-L268`): Handles country selection click (`pinpointCountry`) and tooltip positioning (`moveCountryLabel` using `positionTooltip`).
  - Sub-Tab Router Render (`L317-L338`): Mounts specialized sub-components (`<ApprovalQueue>`, `<ResumeViewer>`, `<StudentActivity>`, `<ChatHistory>`, `<RoleManager>`, `<CompanyManager>`, `<SettingsPanel>`) and vacancy edit forms.

#### 3.4.2 [admin/AdminSummary.tsx](../features/admin/AdminSummary.tsx)
- **Main Purpose & Architectural Role**: High-level administrative dashboard overview. Computes portal-wide activity metrics (active students, applications submitted, exhibitors, event check-ins, CCA eligibility) and renders ranked CSS bar charts for top companies, jobs, and events.
- **Exported Symbols**: `BarChart({ title, rows })`, `AdminSummary()`.
- **Detailed Code Block Breakdown**:
  - `topBy` & `Stat` Helpers (`L5-L13`): Aggregates items by key and renders metric cards (`Stat`).
  - `BarChart` Component (`L15-L33`): Renders styled horizontal CSS bar charts displaying relative proportions (`Math.max(6, (count / max) * 100)%`).
  - `AdminSummary` Component (`L36-L79`): Subscribes to applications, views, attendance, events, and companies. Computes unique active students (`activeStudents`), total applications, exhibitor tallies, and CCA check-ins. Renders summary stats grid and bar charts (`Most-applied companies`, `Most-applied jobs`, `Best-attended events`).

#### 3.4.3 [admin/ApprovalQueue.tsx](../features/admin/ApprovalQueue.tsx)
- **Main Purpose & Architectural Role**: Administrative approval queue dashboard. Displays pending self-service employer registrations (`employer_signups`), pending vacancy submissions, and staged edit diffs (`pendingEdit`). Offers individual review, side-by-side diff inspection, and 1-click bulk **"Approve all"** execution.
- **Exported Symbols**: `ApprovalQueue({ jobs })`.
- **Detailed Code Block Breakdown**:
  - Diff Extractors (`L14-L25`): `jobChanges` and `companyChanges` compare `pendingEdit` maps against live document fields to generate side-by-side field diff rows `[field, was, becomes]`.
  - `CompanyPreview` Modal (`L27-L52`): In-modal profile previewer displaying company logo, summary, and video before approval.
  - `ApprovalQueue` Component (`L54-L151`): Subscribes to `companies` and `employer_signups`. Renders pending vacancy queue with side-by-side diff highlights, individual `approveJob` / `rejectJob` buttons, bulk `Approve all` transaction trigger, and pending employer registration queue with `approveSignup` (which automatically whitelists email in `whitelisted_emails` and creates exhibitor entry in `companies`).

#### 3.4.4 [admin/CompanyManager.tsx](../features/admin/CompanyManager.tsx)
- **Main Purpose & Architectural Role**: Exhibitor showcase profile editor. Enables administrators to manage all exhibitors (add, edit, delete, clear all) with Clearbit website logo auto-fetching (`logoFromWebsite`), booth assignments, and display ordering. Enables employers to manage their single assigned company profile with staged edit submissions.
- **Exported Symbols**: `CompanyManager({ employer, view })`.
- **Detailed Code Block Breakdown**:
  - Subscriptions & Hydration (`L20-L38`): Subscribes to `companies` collection. In employer mode, auto-populates draft from employer's assigned company.
  - `submit` Handler (`L40-L77`): Saves exhibitor profile via `saveCompany`. In employer mode, stages profile edits (`stageCompanyEdit`) for admin review if profile is already approved.
  - Employer Mode Render (`L83-L96`): Displays single company profile editor scoped to employer's company name.
  - Admin Mode Render (`L98-L134`): Displays exhibitor management list with inline editing, deletion (`deleteCompany`), and bulk clear (`clearCompanies`).
  - `CompanyForm` Sub-Component (`L136-L169`): Form rendering inputs for company name, website URL, logo URL (with Clearbit auto-fetch button), logo tile background override (`auto`/`light`/`dark`), corporate video URL, booth number, and corporate summary.

#### 3.4.5 [admin/EmployerSummary.tsx](../features/admin/EmployerSummary.tsx)
- **Main Purpose & Architectural Role**: Scoped analytics summary dashboard for partner employers. Displays total applications, unique applicants, vacancies applied to, and assistant question tallies scoped strictly to the assigned company.
- **Exported Symbols**: `EmployerSummary({ companies })`.
- **Detailed Code Block Breakdown**:
  - Real-Time Subscriptions (`L12-L20`): Subscribes to applications (`subscribeApplications`) and company-specific chat logs (`subscribeCompanyChats`).
  - Tenant Scope Filtering (`L22-L26`): Filters applications (`mine = apps.filter(a => companies.includes(a.company))`) and flattens company chat questions. Ranks applications by vacancy.
  - Render Layout (`L28-L51`): Displays summary statistics cards (`Total applications`, `Unique applicants`, `Jobs applied to`, `Questions asked`) and a `BarChart` breakdown of applications by vacancy title.

#### 3.4.6 [admin/StudentActivity.tsx](../features/admin/StudentActivity.tsx)
- **Main Purpose & Architectural Role**: Student candidate application feed viewer. Displays real-time student application activity. Offers an accordion feed grouped by student for admins, and a company-scoped feed for employers.
- **Exported Symbols**: `StudentActivity({ mode, companies })`.
- **Detailed Code Block Breakdown**:
  - Date & Sort Helpers (`L5-L14`): Formats Firestore Timestamps into human-readable strings and handles pending serverTimestamp sorting.
  - Employer Scoped Mode (`L32-L51`): Filters applications strictly by employer company list (`companies.includes(app.company)`), rendering a flat chronological feed.
  - Admin Grouped Mode (`L54-L82`): Groups applications by student ID/email into expandable `<details>` accordions, displaying candidate application counts and history.

#### 3.4.7 [admin/ResumeViewer.tsx](../features/admin/ResumeViewer.tsx)
- **Main Purpose & Architectural Role**: Candidate resume reviewer component. Enables administrators to view all submitted student resumes (generated CVs and links). Enables employers to view applicant resumes for their company vacancies based strictly on the resume type chosen by each candidate during application.
- **Exported Symbols**: `ResumeViewer({ employer })`.
- **Detailed Code Block Breakdown**:
  - Real-Time Subscriptions (`L10-L17`): Subscribes to `resumes` and `applications`.
  - Employer Scoped Mode (`L23-L80`): Maps applications to candidate resumes, respecting student's attached resume choice (`app.resumeChoice`). Renders candidate cards with in-app `<GeneratedCV>` expansion, external link opening, and standalone HTML download (`downloadCV`).
  - Admin Mode (`L83-L113`): Lists all student resumes with text search, in-app CV rendering, link opening, and HTML downloading.

#### 3.4.8 [admin/ChatHistory.tsx](../features/admin/ChatHistory.tsx)
- **Main Purpose & Architectural Role**: Assistant conversation audit viewer. Enables administrators to review all student AI assistant questions grouped by student. Enables employers to review questions asked about their company, strictly anonymized without candidate identities.
- **Exported Symbols**: `ChatHistory({ mode, companies })`.
- **Detailed Code Block Breakdown**:
  - `AllChats` Admin Component (`L17-L56`): Subscribes to `subscribeAllChats`. Groups chat logs by student identity into expandable `<details>` accordions showing candidate name, email, target company, question, and generated answer.
  - `CompanyChats` Employer Component (`L59-L98`): Subscribes to `subscribeCompanyChats` for each assigned company. Renders anonymized question-and-answer pairs without student names or emails.

#### 3.4.9 [admin/SettingsPanel.tsx](../features/admin/SettingsPanel.tsx)
- **Main Purpose & Architectural Role**: System-wide configuration panel for non-IT administrative staff. Enables editing portal title, tagline, default QR code rotation frequency, CCA percentage thresholds, minimum session floors, tab visibility toggles, and executing superadmin master database resets.
- **Exported Symbols**: `SettingsPanel()`.
- **Detailed Code Block Breakdown**:
  - Subscriptions & Handlers (`L21-L57`): Subscribes to `app_settings/app` document. Provides `submit` handler invoking `saveSettings` to persist title, tagline, QR rotation seconds, CCA rules, and tab visibility states.
  - Reset Action (`L29-L37`): `resetAll` prompts superadmin for confirmation (`CONFIRM-RESET`) and executes `resetAllData` to erase portal documents while preserving superadmin identity.
  - Form Render (`L60-L83`): Renders input fields for branding, attendance rules (QR rotate, CCA %, floor minutes), and section visibility checkboxes (`home`, `events`, `vacancies`, `resume`, `history`).
  - Danger Zone (`L84-L91`): Renders superadmin-only database reset button.

### 3.5 Student Subsystem (`features/student/`)

#### 3.5.1 [student/StudentHistory.tsx](../features/student/StudentHistory.tsx)
- **Main Purpose & Architectural Role**: Student personal activity dashboard. Displays lists of vacancies applied to (with 1-click application withdrawal), recently viewed jobs, and event attendance records with CCA eligibility status.
- **Exported Symbols**: `StudentHistory({ jobs, applications, views, attendance, onOpen })`.
- **Detailed Code Block Breakdown**:
  - Search & Sorting (`L31-L39`): Filters applications, views, and attendance by text search query, sorting by timestamp.
  - Applied Vacancies Section (`L61-L77`): Renders candidate's submitted applications with vacancy open button and 1-click application withdrawal button (`deleteApplication`).
  - Viewed Jobs Section (`L79-L84`): Renders recently opened vacancy cards.
  - Attended Events Section (`L86-L95`): Renders event attendance log showing session title, check-in time, duration minutes, and CCA eligibility badge (`✓ CCA eligible`, `Below threshold`, `Checked in`).

#### 3.5.2 [student/StudentResume.tsx](../features/student/StudentResume.tsx)
- **Main Purpose & Architectural Role**: Student resume management hub. Enables candidates to build a structured profile (headline, summary, phone, CGPA, FYP title/summary, education, experience, skills, achievements, portfolio links) for live `<GeneratedCV>` rendering, or paste an external shareable resume link.
- **Exported Symbols**: `StudentResume({ user, course, myResume })`.
- **Detailed Code Block Breakdown**:
  - Form State & Live Preview (`L22-L41`): Binds profile fields to `profile` state. Constructs `previewProfile` with parsed link arrays, evaluating `hasGeneratedCV(previewProfile)` to drive live preview readiness.
  - CV Action Handlers (`L43-L105`): `saveProfile` persists profile to Firestore `resumes/{uid}` via `saveResume`. `clearGeneratedCV` clears profile map. `submitLink` validates HTTP/HTTPS URL and saves external resume link.
  - Status Cards (`L114-L129`): Renders status indicators showing whether a generated CV or shared link is currently saved on file.
  - Option 1 Form & Live Preview (`L133-L160`): Dual-column builder layout rendering CV input fields alongside live `<GeneratedCV>` preview sheet with print/PDF button (`window.print()`).
  - Option 2 Shared Link Form (`L162-L181`): URL input field and Google Drive / OneDrive sharing instructions.

#### 3.5.3 [student/GeneratedCV.tsx](../features/student/GeneratedCV.tsx)
- **Main Purpose & Architectural Role**: Standardized CV sheet renderer. Transforms structured candidate profile fields into a clean, printable document. Shared between the student's builder preview and the administrative candidate resume viewer.
- **Exported Symbols**: `GeneratedCV({ name, email, course, profile })`.
- **Detailed Code Block Breakdown**:
  - `Block` Sub-Component (`L4-L12`): Helper component rendering a labeled section (`<h3>`) only when body content is non-empty.
  - `GeneratedCV` Render (`L19-L80`): Renders `<article className="cv-sheet">` containing candidate name header, headline, contact row (email, phone, course), portfolio link pills, executive summary block, Final-Year Project block (title, summary), education block (CGPA, institution), experience block, skills badge list, and achievements block.

#### 3.5.4 [student/cv-download.ts](../features/student/cv-download.ts)
- **Main Purpose & Architectural Role**: Zero-cost HTML/PDF CV export generator. Generates a standalone, beautifully styled HTML document containing the candidate's CV data and print CSS media queries (`@media print`), triggering a direct browser file download without requiring cloud storage subscriptions.
- **Exported Symbols**: `downloadCV(resume)`.
- **Detailed Code Block Breakdown**:
  - Escaping & Formatting Helpers (`L3-L4`): `esc` escapes HTML entities (`&`, `<`, `>`). `para` converts newlines to `<br>`.
  - HTML Template Assembly (`L11-L40`): Assembles complete HTML5 document string with embedded CSS styles for card layout, serif headers, skill badges, and print CSS rules (`@media print { .sheet { box-shadow: none; margin: 0; } }`).
  - Blob & Download Trigger (`L42-L49`): Wraps HTML string in a `Blob` (`text/html;charset=utf-8`), creates object URL, synthesizes invisible `<a>` element with `download="CV_{name}.html"`, triggers `click()`, and revokes object URL.

### 3.6 Events & Anti-Cheat Subsystem (`features/events/`)

#### 3.6.1 [events/EventsView.tsx](../features/events/EventsView.tsx)
- **Main Purpose & Architectural Role**: Primary event schedule directory view. Displays live, upcoming, and ended Industry Day sessions, speaker headshots, presenter QR launcher buttons, administrative attendance viewers, and event CRUD controls.
- **Exported Symbols**: `EventsView({ events, canManageEvents, userEmail, myAttendance, settings, onOpenEvent })`.
- **Detailed Code Block Breakdown**:
  - Status Resolution (`L10-L28`): `eventStatus` compares Date.now() against session `startAt` and `endAt` ISO timestamps to return `"live"`, `"upcoming"`, or `"ended"`. `statusMeta` maps status to labels and tone classes (`● Live now` -> `tone-success`).
  - Event Filtering & Sorting (`L52-L59`): Filters events by search query (title, location, speaker) and sorts live sessions first, followed by upcoming and ended sessions.
  - Event Cards Render (`L74-L115`): Renders event schedule cards with status pills, student attendance status (`✓ CCA eligible`, `Below threshold`, `Checked in`), event title, date/time range, `<SpeakerAvatar>`, details button, and delegated presenter/admin action buttons (`▶ Present QR`, `Attendance`, `Edit`, `Delete`).

#### 3.6.2 [events/EventDetail.tsx](../features/events/EventDetail.tsx)
- **Main Purpose & Architectural Role**: Detailed event modal dialog. Renders session description, speaker avatar, portfolio links, session schedule, calculated CCA eligibility threshold minutes, personal student attendance status, and presenter notes.
- **Exported Symbols**: `EventDetail({ event, canManageEvents, userEmail, attendance, settings, onClose })`.
- **Detailed Code Block Breakdown**:
  - Threshold Calculation (`L38`): Computes minimum required physical attendance minutes via `ccaThresholdMinutes(event.sessionMinutes, settings)`.
  - Content Sections (`L53-L101`): Renders description text, `<SpeakerAvatar>` block with external links, schedule table (start time, end time, session length, CCA threshold), and student attendance status panel.

#### 3.6.3 [events/EventForm.tsx](../features/events/EventForm.tsx)
- **Main Purpose & Architectural Role**: Administrative event editor modal. Enables creating or editing Industry Day talks, setting start/end datetime-local values, auto-calculating session length, attaching speaker photo URLs, and delegating specific presenter emails.
- **Exported Symbols**: `EventForm({ editing, userEmail, defaultRotateSeconds, onClose })`.
- **Detailed Code Block Breakdown**:
  - Time Helpers (`L14-L26`): `minutesBetween` calculates duration between datetime-local inputs. `addMinutes` adjusts end time when session duration is edited.
  - `submit` Handler (`L38-L63`): Parses form inputs, splits delegated presenter emails (`presenters`), parses speaker links, constructs `EventItem` record, and persists via `saveEvent`.
  - Form Fields (`L69-L86`): Renders inputs for title, description, start time, end time, location, auto-calculated session length, speaker name, per-event QR rotation seconds, speaker photo URL (with `<ImagePreview>`), speaker links, and delegated presenter email list.

#### 3.6.4 [events/EventPresenter.tsx](../features/events/EventPresenter.tsx)
- **Main Purpose & Architectural Role**: Presenter live display projector screen. Generates dynamic 30-second rotating QR codes (`REFRESH_MS = 30000`) and 6-character PIN codes, publishing active secrets to unreadable `event_codes/{eventId}` documents to defeat screenshot sharing over messaging apps.
- **Exported Symbols**: `EventPresenter({ event, rotateSeconds, ccaSettings, onClose })`.
- **Detailed Code Block Breakdown**:
  - `randomCode` (`L7-L9`): Generates random 12-character alphanumeric secret string.
  - Rotation Effect Loop (`L23-L39`): Executes every `refreshMs` (e.g. 30,000ms). Generates new `code`, calculates `codeExpiry` (+6s grace), and writes to secret Firestore document `event_codes/{eventId}` via `setEventCode`. Synthesizes client-side QR data URL (`QRCode.toDataURL`) containing check-in URL (`/?ev={eventId}&s={step}&c={code}`).
  - Cleanup (`L41`): Invokes `stopEventCode(event.id)` on close to reset active step to `"none"`.
  - Presenter UI (`L43-L56`): Display screen showing Step 1 Check-in / Step 2 Check-out toggle buttons, large projector QR code image, countdown timer (`Refreshes in Xs`), anti-screenshot warning, and CCA threshold info.

#### 3.6.5 [events/SpeakerAvatar.tsx](../features/events/SpeakerAvatar.tsx)
- **Main Purpose & Architectural Role**: Speaker headshot photo component. Displays speaker photo image when valid URL is provided, falling back to a neutral grey user silhouette SVG.
- **Exported Symbols**: `SpeakerAvatar({ photo, name, className })`.
- **Detailed Code Block Breakdown**:
  - Render Logic (`L3-L8`): If `photo` URL is non-empty, renders `<img src={photo}>`. Otherwise renders `<span className="placeholder">` containing a clean vector silhouette SVG (`<circle>` and `<path>`).

#### 3.6.6 [events/EventAttendance.tsx](../features/events/EventAttendance.tsx)
- **Main Purpose & Architectural Role**: Administrative attendance log viewer. Renders real-time check-in and check-out logs for a specific event, showing student names, emails, duration minutes, and CCA eligibility status, with 1-click UTF-8 BOM CSV spreadsheet export.
- **Exported Symbols**: `EventAttendance({ event, onClose })`.
- **Detailed Code Block Breakdown**:
  - `downloadCsv` (`L13-L27`): Constructs CSV string from attendance rows, prepends UTF-8 Byte Order Mark (`\uFEFF`), creates Blob (`text/csv;charset=utf-8;`), and triggers direct download (`attendance_{title}.csv`).
  - `EventAttendance` Component (`L29-L60`): Subscribes to `attendance` collection, filtering rows by `eventId`. Renders attendee count, Excel CSV export button, and chronological list of check-in records with CCA badges (`✓ CCA eligible`, `Below threshold`, `Checked in`).


---

### 3.7 Mock Interviews (`features/student/`, `features/admin/`)

#### [student/InterviewBookingModal.tsx](../features/student/InterviewBookingModal.tsx)
- **Role**: Student-facing slot browser and booking action, opened from a company profile or a vacancy.
- **Note**: Blocks double-booking across companies. Firestore rules can enforce one slot's capacity but cannot see across documents, so the *time clash* check is necessarily client-side (`overlaps()`); capacity itself is enforced by the rules and a transaction.

#### [admin/EmployerInterviewManager.tsx](../features/admin/EmployerInterviewManager.tsx)
- **Role**: Employer panel to open, list and delete mock interview slots, and to see who booked them.
- **Note**: Renders by walking the slot's seat list and joining each uid against `interview_bookings`. That direction matters — the seat list is the source of truth, so a stray booking document with no matching seat is never shown.

### 3.8 Live Q&A and reviews (`features/events/`)

#### [events/TalkLiveChat.tsx](../features/events/TalkLiveChat.tsx)
- **Role**: The Q&A box for one talk. Closed by default; opened by an admin or the presenter assigned to that event.
- **Note**: The open/closed flag is its own document (`event_live_chat`), not a field on the event, because presenters are not admins and cannot write the event doc. The rules reject messages while the box is closed, so a crafted client cannot post into a closed session.

#### [events/TalkFeedback.tsx](../features/events/TalkFeedback.tsx)
- **Role**: Post-talk student reviews with a running average.
- **Note**: Only attendees may write one. Enforced in the rules by an `exists()` check against the attendance document — the UI gate is a convenience, not the control.

---

## 4. Data & Domain Layer (`webapp/lib/`)

### 4.1 [lib/data/types.ts](../lib/data/types.ts)
- **Main Purpose & Architectural Role**: Canonical domain interface dictionary. Defines TypeScript types and contracts shared across all feature modules and Firestore database operations.
- **Exported Symbols**: `UserRole`, `JobStatus`, `Job`, `Application`, `ViewEvent`, `ResumeProfile`, `hasGeneratedCV(profile)`, `Resume`, `ChatLog`, `EventItem`, `EventCode`, `Attendance`, `UserRecord`, `Company`, `isApprovedCompany(c)`, `EmployerSignup`, `AppSettings`.
- **Detailed Code Block Breakdown**:
  - Interface Specifications (`L10-L238`): Canonical definitions for `Job` (id, title, company, type, specialization, vacancies, location, salary, status, pendingEdit, createdBy), `Application` (id, studentUid, jobId, resumeChoice, appliedAt), `ViewEvent`, `ResumeProfile`, `Resume`, `ChatLog`, `EventItem` (with presenters array), `EventCode` (activeStep, activeCode, codeExpiry), `Attendance` (checkInMs, checkOutMs, durationMinutes, caEligible), `UserRecord`, `Company` (boothNumber, logoBackground, status, pendingEdit), `EmployerSignup`, and `AppSettings` (portalTitle, qrRotateSeconds, ccaPercent, tabs).
  - Utility Functions (`L86-L93`, `L205`): `hasGeneratedCV` checks if profile has sufficient content; `isApprovedCompany` evaluates exhibitor status.

### 4.2 The Firestore access layer (`lib/data/`)

**This folder is the only place the app talks to Firestore.** Feature components
import from [lib/data/firestore.ts](../lib/data/firestore.ts), which is a barrel
re-exporting the modules below. Nothing outside this folder should import from
`firebase/firestore` directly — that boundary is what makes the backend
replaceable, and it is the first thing to check in review.

| Module | Owns |
| --- | --- |
| [client.ts](../lib/data/client.ts) | `COLLECTIONS`, `DEFAULT_SETTINGS`, `requireDb()`, `clean()`. Connection plumbing only, no domain logic. |
| [vacancies.ts](../lib/data/vacancies.ts) | Vacancies and their approval workflow, applications, view history, the public `job_stats` tally, resumes. |
| [events.ts](../lib/data/events.ts) | Talks, the rotating attendance code, attendance and CCA duration maths, student interest, the live Q&A switch and messages, post-event reviews. |
| [interviews.ts](../lib/data/interviews.ts) | Mock interview slots and bookings. |
| [companies.ts](../lib/data/companies.ts) | Exhibitor profiles, their approval workflow, and profile-visit logging. |
| [employers.ts](../lib/data/employers.ts) | Employer self-registration, access revocation, superadmin data reset. |
| [settings.ts](../lib/data/settings.ts) | The single runtime settings document. |
| [chat-logs.ts](../lib/data/chat-logs.ts) | Persisted assistant turns. |

**Two invariants a new developer must not break.**

1. *Counters that students can move are never plain fields.* A field a client
   increments can be set to any value from the browser console. Profile visits
   are **counted** from write-once `company_views` documents whose ids the rules
   pin to one per student per company per day; interest tallies are counted from
   `event_interests`, whose id is `{eventId}_{uid}`. See `countCompanyViews` and
   `countEventInterests`.
2. *Anything a student can write needs a rule before it needs a UI.* Several
   fields were originally written onto the `events` and `companies` documents,
   where `validEvent` / `validCompany` pin the key set and restrict writes to
   admins — the writes were silently rejected and the features looked fine while
   counting nothing. Sidecar collections exist for exactly this reason.

### 4.3 [lib/data/course-map.ts](../lib/data/course-map.ts)
- **Main Purpose & Architectural Role**: Institutional QIU academic programme catalogue and course recommendation matcher. Derived from `Programes/qiu_all_programmes.csv`, mapping directory abbreviations (e.g. `BCS`, `BAC`, `BME`, `BHM`) to full programme names, academic levels, faculties, and target vacancy specialization regex patterns.
- **Exported Symbols**: `ProgrammeLevel`, `Programme`, `PROGRAMMES`, `COURSE_CODES`, `ResolvedCourse`, `resolveCourse(raw)`, `courseToSpecializationPattern(course)`, `jobMatchesCourse(job, course)`.
- **Detailed Code Block Breakdown**:
  - `PROGRAMMES` Dictionary (`L18-L79`): Complete catalogue of QIU academic programs across Faculty of Business & Management (`FIA`, `BAC`, `BBA`, `BFN`), Faculty of Computing & Engineering (`DME`, `DIT`, `BCS`, `BIT`, `BME`), Life Sciences (`BFS`, `BBT`), Social Sciences (`BCC`, `BPY`, `BTE`), Medicine (`MBBS`), and Pharmacy (`BPH`).
  - `resolveCourse` (`L99-L115`): Matches raw student directory strings against programme abbreviations or full names, returning resolved `{ code, name, level, faculty }`.
  - `courseToSpecializationPattern` (`L121-L134`): Maps course names to specialization regex patterns (e.g., Computer Science -> `/^IT\b|IT\s*-|Software/i`, Accountancy -> `/accounting|finance/i`, Mechatronics -> `/manufacturing|engineering/i`).
  - `jobMatchesCourse` (`L137-L145`): Evaluates whether a vacancy title or specialization matches the student's academic course pattern.

### 4.4 [lib/auth/course-directory.ts](../lib/auth/course-directory.ts)
- **Main Purpose & Architectural Role**: Integration module for Google Workspace People API. Queries student directory profile fields (`organizations` and `occupations`) using an OAuth access token, extracting program codes and resolving them via `course-map.ts`.
- **Exported Symbols**: `PEOPLE_SCOPE`, `fetchDirectoryCourse(accessToken)`.
- **Detailed Code Block Breakdown**:
  - `PEOPLE_SCOPE` (`L12`): Defines Google OAuth 2.0 directory scope string (`https://www.googleapis.com/auth/directory.readonly`).
  - `fetchDirectoryCourse` (`L23-L45`): Makes HTTP GET request to `https://people.googleapis.com/v1/people/me?personFields=organizations,occupations` with Bearer token. Inspects organization titles, departments, and occupation fields, resolving candidate strings via `resolveCourse`. Returns matched `{ code, name }` or `null` on failure.

### 4.5 [lib/calendar.ts](../lib/calendar.ts)
- **Role**: Builds the Google Calendar template URL and the downloadable `.ics` for a talk reminder.
- **Exported Symbols**: `generateGoogleCalendarUrl(event)`, `downloadIcsFile(event)`.

### 4.6 [lib/toxic-filter.ts](../lib/toxic-filter.ts)
- **Role**: Screens what students type at a company or a speaker — the live Q&A and every assistant chatbox.
- **Exported Symbols**: `checkToxicContent(text)`, `isToxicText(text)`, `TOXIC_REPLY`.
- **Note**: Deliberately narrow. This portal exists so students can ask employers hard questions, so criticism ("is this a scam?", "I don't like the hours") must pass while abuse aimed at a person does not. A remote classifier (Intel/toxic-prompt-roberta) runs only if `NEXT_PUBLIC_TOXIC_API_URL` is set; the app is a static export, so that must point at a proxy holding the token — never put the token in a `NEXT_PUBLIC_` variable.
- **Limitation**: This runs in the browser and is therefore bypassable. It reduces accidental abuse; it is not a security control.

### 4.7 [lib/theme/tokens.css](../lib/theme/tokens.css)
- **Main Purpose & Architectural Role**: Primary design token architecture seam. Defines the Signature QIU-Red visual identity palette (`#ba1a1a` / `#900010` / `--color-primary: #d12a32`, dark mode `#ef5a60`), surface tokens, functional state colors, spacing scales, shadow depths, and dark mode theme overrides.
- **Exported Symbols**: Global CSS Tokens stylesheet (imported by `globals.css`).
- **Detailed Code Block Breakdown**:
  - Light Theme Token Block (`:root` `L16-L58`): Defines core brand color `--color-primary: #d12a32` (hover `#b21f27`, soft background `#fbe9ea`), page background `--color-page: #1b1b1e`, content surface `--color-surface: #ffffff`, text color `--color-text: #17171a`, functional success/warning/danger/info colors, radius scale, shadow depths, and legacy compatibility variables (`--blue`, `--surface`, `--ink`).
  - Dark Theme Overrides (`:root[data-theme="dark"]` `L60-L90`): Adjusts page background to `#08080a`, content surface to `#18181b`, text to `#f4f4f5`, and brightens primary brand red to `--color-primary: #ef5a60` for high contrast on dark surfaces.

---

## 5. Security Rules, Scripts & Build Configurations

### 5.1 [firestore.rules](../firestore.rules)
- **Main Purpose & Architectural Role**: Server-side Cloud Firestore Security Rules v2 file. Enforces Google Auth gate (`@qiu.edu.my` domain or `whitelisted_emails`), 4-role RBAC authorization matrix (`user`, `employer`, `admin`, `superadmin`), strict schema validation for every collection, unreadable secret dynamic QR code assertion, two-step anti-cheat attendance verification, and rate limits.
- **Exported Symbols**: Server Security Rules definition.
- **Detailed Code Block Breakdown**:
  - Authentication & Role Helpers (`L5-L46`): `isAuthenticated()` (verifies Google provider and verified email), `isQiuUser()` (matches `@qiu.edu.my`), `isWhitelisted()` (checks `whitelisted_emails`), `isSuperAdmin()` (fixed to `ai@qiu.edu.my`), `isAdmin()`, `isEmployer()`.
  - Schema Validation Helpers (`L48-L188`): Detailed validation functions: `validUser`, `validVacancy`, `validApplication`, `validResume`, `validCompany`, `validSettings`, `validChatLog`, `validEvent`.
  - Collection Match Rules (`L197-L411`):
    - `users/{uid}` (`L197-L208`): Owner reads/creates; role modification restricted to admins/superadmin.
    - `whitelisted_emails/{emailId}` (`L210-L214`): Authenticated read; admin write.
    - `vacancies/{vacancyId}` (`L216-L250`): Authenticated read; admins publish live; employers create/update only their own jobs as `'pending'` or stage `'pending_edit'`.
    - `applications/{appId}` (`L254-L262`): Candidate creates/deletes own application; candidate, employer, and admin read.
    - `resumes/{uid}` (`L277-L285`): Student creates/edits own resume; student, employer, and admin read.
    - `chat_logs/{id}` (`L292-L299`): Student creates; admins and employers read.
    - `events/{eventId}` (`L302-L306`): Authenticated read; admin write.
    - `event_codes/{eventId}` (`L311-L319`): **Unreadable by client queries** (`allow read: if isAdmin()`). Written by admins or assigned delegated presenters.
    - `attendance/{attendanceId}` (`L323-L343`): **Server-side anti-cheat assertion**: Evaluates `eventCode(eventId)` server state during write. Verifies active step (`checkin`/`checkout`), active code match, and timestamp expiry (`request.time.toMillis() < codeExpiry`).
    - `companies/{companyId}` (`L358-L376`): Authenticated read; admins manage all; employers create/edit assigned company profile as `'pending'`/`'pending_edit'`.
    - `employer_signups/{emailId}` (`L389-L411`): Visitor submits/reads own request; admin reviews and approves.

### 5.2 [storage.rules](../storage.rules)
- **Main Purpose & Architectural Role**: Firebase Storage Security Rules file governing candidate PDF resume file uploads.
- **Exported Symbols**: Storage Security Rules definition.
- **Detailed Code Block Breakdown**:
  - `resumes/{uid}/{fileName}` Match (`L11-L19`): Signed-in users can read resume files. Only the owning student (`request.auth.uid == uid`) can upload or delete their PDF file. Restricts uploads strictly to `application/pdf` format and enforces a 5 MB maximum file size limit (`request.resource.size < 5 * 1024 * 1024`).

### 5.3 [scripts/generate_data.py](../scripts/generate_data.py)
- **Main Purpose & Architectural Role**: Offline Python data preprocessing and normalization script. Processes source spreadsheets (`company_discussions.xlsx` and `vacancy.csv`) to generate `data/jobs.json` for superadmin initial data seeding.
- **Exported Symbols**: Executable Python script (`python3 scripts/generate_data.py`).
- **Detailed Code Block Breakdown**:
  - `salary_number` Helper (`L11-L13`): Extracts numeric integer salary figures from raw strings using regular expressions.
  - Excel Discussion Parsing (`L15-L26`): Reads `company_discussions.xlsx` using `pandas`. Extracts company corporate summaries and source links into a lookup dictionary indexed by case-folded company names.
  - CSV Vacancy Processing (`L28-L50`): Parses `vacancy.csv` using Python's `csv.DictReader`. Merges vacancy fields with discussion profiles, assigning incremental numeric IDs, parsing minimum requirements, locations, and enquiry emails.
  - Output Generation (`L51-L53`): Writes formatted JSON array to `webapp/data/jobs.json`.

### 5.4 [package.json](../package.json)
- **Main Purpose & Architectural Role**: Project manifest configuring dependencies, Node.js engine constraints (`>=22.13.0`), module type (`"type": "module"`), and npm execution scripts.
- **Exported Symbols**: Package configuration file.
- **Detailed Code Block Breakdown**:
  - Scripts (`L8-L15`): Defines `dev` (`next dev`), `build` (`next build`), `start` (`npx serve out`), `test` (`npm run build` followed by Node test runner execution over unit test suites), `test:rules` (launches Firebase Firestore Emulator and runs `firestore-rules.test.mjs`), and `lint` (`eslint .`).
  - Dependencies (`L16-L34`): Core dependencies include `next` (16.2.12), `react` (19.2.6), `firebase` (12.3.0), `qrcode` (1.5.4), `@tailwindcss/postcss` (4.2.1), `typescript` (5.9.3), and `@firebase/rules-unit-testing` (5.0.1).

### 5.5 [next.config.ts](../next.config.ts)
- **Main Purpose & Architectural Role**: Next.js framework configuration file enforcing static export generation.
- **Exported Symbols**: `default nextConfig: NextConfig`.
- **Detailed Code Block Breakdown**:
  - Config Declaration (`L3-L5`): Sets `output: "export"`. Compiles the entire Next.js App Router project into static HTML/JS/CSS assets inside `out/` suitable for edge deployment on Firebase Hosting CDN.

### 5.6 [postcss.config.mjs](../postcss.config.mjs)
- **Main Purpose & Architectural Role**: PostCSS plugin configuration file enabling Tailwind CSS v4 processing.
- **Exported Symbols**: `default config`.
- **Detailed Code Block Breakdown**:
  - Config (`L1-L7`): Integrates `@tailwindcss/postcss` plugin engine.

### 5.7 [eslint.config.mjs](../eslint.config.mjs)
- **Main Purpose & Architectural Role**: ESLint flat configuration file establishing syntax, typing, and React code quality rules.
- **Exported Symbols**: `default eslintConfig`.
- **Detailed Code Block Breakdown**:
  - Config (`L5-L18`): Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. Configures global ignore patterns for `.next/**`, `out/**`, and `build/**`.

---

## 6. Automated Test Suites (`webapp/tests/`)

### 6.1 [tests/admin-form-regression.test.mjs](../tests/admin-form-regression.test.mjs)
- **Main Purpose & Architectural Role**: Source code regression test suite verifying admin vacancy form state preservation, salary normalization, and filter state handling in `page.tsx`.
- **Exported Symbols**: Executable Node.js test suite (`npm test`).
- **Detailed Code Block Breakdown**:
  - Tests (`L8-L72`): Asserts salary field clearing logic, verifies Firestore `onSnapshot` subscription wiring, asserts role permission gates (`canManageVacancies`), checks Kuala Lumpur territory mapping, verifies field preservation during vacancy editing (`payFrequency`, `companySummary`), and tests admin filter resets.

### 6.2 [tests/chat-retrieval.test.mjs](../tests/chat-retrieval.test.mjs)
- **Main Purpose & Architectural Role**: Unit test suite for grounded RAG assistant retrieval logic (`app/chat.ts`). Validates token matching, study area boosting, and exact word-boundary matching.
- **Exported Symbols**: Executable Node.js test suite (`npm test`).
- **Detailed Code Block Breakdown**:
  - Tests (`L11-L54`): Verifies computer science typo matching, asserts out-of-domain query rejections for marine biology, tests company name retrieval, checks conversational intent handling, and verifies word-boundary matching to prevent false positives (e.g., matching `"art"` inside `"Smart"`).

### 6.3 [tests/employer-whitelist.test.mjs](../tests/employer-whitelist.test.mjs)
- **Main Purpose & Architectural Role**: Authorization policy unit test suite (`app/auth-policy.ts`). Validates email whitelisting, role assignment, employer vacancy ownership boundaries, and YouTube URL embedding logic.
- **Exported Symbols**: Executable Node.js test suite (`npm test`).
- **Detailed Code Block Breakdown**:
  - Tests (`L5-L35`): Tests `isAllowedAccessEmail` for `@qiu.edu.my` and external accounts, tests `roleForEmail`, verifies `canEditOrDeleteJob` tenant boundary isolation, and validates `getYouTubeEmbedUrl` conversions.

### 6.4 [tests/firestore-rules.test.mjs](../tests/firestore-rules.test.mjs)
- **Main Purpose & Architectural Role**: Emulator-backed integration test suite for Cloud Firestore Security Rules (`firestore.rules`). Executes assertions against `@firebase/rules-unit-testing` and local Firestore Emulator.
- **Exported Symbols**: Executable emulator test suite (`npm run test:rules`).
- **Detailed Code Block Breakdown**:
  - Tests (`L131-L338`): Verifies domain access restrictions (`@qiu.edu.my` vs external), profile role self-elevation prevention, superadmin immutable permissions, vacancy creation/update authorization, employer staged edit permissions (`pending_edit`), application privacy, resume access rules, chat log permissions, and unreadable secret assertion enforcement.

### 6.5 [tests/map-tooltip-regression.test.mjs](../tests/map-tooltip-regression.test.mjs)
- **Main Purpose & Architectural Role**: Unit test suite for interactive world map tooltip positioning math (`app/map-tooltip.ts`).
- **Exported Symbols**: Executable Node.js test suite (`npm test`).
- **Detailed Code Block Breakdown**:
  - Tests (`L11-L33`): Verifies tooltip boundary calculations across container corners (top-left, top-right, bottom-left, bottom-right) ensuring tooltips remain inside map bounds without CSS transform shifts.

### 6.6 [tests/slm-engine.test.mjs](../tests/slm-engine.test.mjs)
- **Main Purpose & Architectural Role**: Unit test suite for client-side Small Language Model engine (`app/slm-engine.ts`).
- **Exported Symbols**: Executable Node.js test suite (`npm test`).
- **Detailed Code Block Breakdown**:
  - Tests (`L10-L35`): Validates intent classification (`TIME_DATE`, `GREETING`, `SALARY_COMPARISON`, `INTERNSHIP_SEARCH`, `ACADEMIC_MATCH`), checks SLM metadata generation, and asserts out-of-domain query rejections for off-topic prompts (recipes, math, trivia).

### 6.7 [tests/event-features.test.mjs](../tests/event-features.test.mjs)
Guards the engagement feature set against the mistakes that were actually made building it: counters written to rule-protected documents, a client-writable visit counter, PII on the campus-readable slot document, a calendar tab opened after an `await` (the popup blocker eats it), and any student chatbox that stops screening input.

### 6.8 [tests/interview-booking.test.mjs](../tests/interview-booking.test.mjs)
Asserts the mock interview helpers and components exist and are named consistently.

### 6.9 [tests/toxic-filter.test.mjs](../tests/toxic-filter.test.mjs)
Pins both directions of the filter: abuse is flagged, and blunt-but-legitimate questions are not. The second half matters as much as the first — a filter that eats real questions teaches students not to ask.

### 6.10 Running the suites
```bash
npm test          # builds, then runs the Node test suites
npm run test:rules  # boots the Firestore emulator and runs firestore-rules.test.mjs
```
`npm run test:rules` is **not** part of `npm test` and is the only thing that verifies `firestore.rules`. Run it before any deploy that touches rules.
