# QIU Industry Webapp — Developer Quickstart & Technical Architecture

> [!NOTE]
> **Status:** Active Internal Testing Phase — Currently undergoing internal validation. Live deployment links and public hosting URLs are strictly withheld during testing.

**QIU Industry Webapp** (`webapp/`) is the static-exported Next.js 16 web application powering the QIU Industry career, event discovery, exhibitor showcase, and anti-cheat attendance portal. Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript 5.9**, **Tailwind CSS v4.2**, **Cloud Firestore**, and **Firebase Authentication**.

> [!IMPORTANT]
> **Security & Privacy Boundary:** Application code operates entirely on static client-side rendering (`output: "export"`). Security guarantees rely strictly on server-enforced Cloud Firestore Security Rules ([firestore.rules](firestore.rules)). Raw CSV/XLSX source files and intermediate JSON datasets (`data/jobs.json`) are excluded from Git and static build bundles.

---

## Technical Documentation Index

For detailed system specs, security architecture, schemas, and feature guides, consult the sub-documents in `webapp/docs/`:

1. **[SOFTWARE_DOCUMENTATION.md](docs/SOFTWARE_DOCUMENTATION.md)** *(Comprehensive System Architecture Specification)*  
   Complete system context, architectural design decisions, component design hierarchy, sequence diagrams, technology stack, and production procedures.

2. **[SECURITY_AND_RULES.md](docs/SECURITY_AND_RULES.md)** *(Security Model, Firestore Security Rules & 30s Dynamic QR Math)*  
   Deep dive into authentication gates, the 4-role RBAC matrix, line-by-line Firestore security rules, 30-second TOTP-style dynamic QR anti-cheat logic, and CCA duration algorithms.

3. **[DATA_MODELS_AND_SCHEMAS.md](docs/DATA_MODELS_AND_SCHEMAS.md)** *(Data Dictionary, TypeScript Interfaces & Firestore Collections)*  
   Exhaustive data dictionary, canonical TypeScript interfaces, Firestore collection specifications (`job_stats`, `companies`, `events`, `event_codes`, `attendance`, `employer_signups`, `app_settings`, etc.), real-time subscriptions, and batch import pipeline.

4. **[FEATURE_MODULES_GUIDE.md](docs/FEATURE_MODULES_GUIDE.md)** *(Feature Modules Technical Specification)*  
   Detailed technical guide covering Home Directory RAG, logo luminance analysis (`useLogoBackdrop.ts`), employer self-registration queue, admin sub-tabs, generated CV engine (`cv-download.ts`), global toast system, image preview component, and events anti-cheat module.

5. **[CODEBASE_FILE_MAP.md](docs/CODEBASE_FILE_MAP.md)** *(Exhaustive File-by-File Technical Code Map)*  
   Comprehensive file-by-file code map documenting every source, component, domain model, security rule, configuration, script, and test suite file with detailed section-by-section code block breakdowns.

---

## Technical Architecture Overview

```text
webapp/
├── app/
│   ├── auth-context.tsx          # Auth state, Google sign-in gate, role manager
│   ├── auth-policy.ts            # Email whitelist & role verification helpers
│   ├── chat.ts                   # Grounded assistant retrieval logic
│   ├── firebase-client.ts        # Firebase SDK initialization (Auth, Firestore, Storage)
│   ├── globals.css               # Tailwind v4 & QIU-Red styling system
│   ├── layout.tsx                # Root layout, Toaster & AuthProvider wrapper
│   └── page.tsx                  # Main application dashboard & tab navigation shell
├── components/
│   ├── ImagePreview.tsx          # Real-time brand logo/photo URL previewer
│   ├── Modal.tsx                 # Accessible modal dialog container
│   └── toast.tsx                 # Global reactive toast notification system
├── docs/                         # Project technical documentation
│   ├── CODEBASE_FILE_MAP.md
│   ├── DATA_MODELS_AND_SCHEMAS.md
│   ├── FEATURE_MODULES_GUIDE.md
│   ├── SECURITY_AND_RULES.md
│   └── SOFTWARE_DOCUMENTATION.md
├── features/                     # Feature modules
│   ├── Guide.tsx                 # Interactive 4-role user guide (Student, Employer, Admin, Super-Admin)
│   ├── admin/                    # Admin sub-tabs (AdminSummary, EmployerSummary, DashboardActivityListModal, DashboardStudentsModal, TalkChatHistory, CompanyManager JSON import)
│   ├── chat/                     # Grounded in-modal streaming assistant
│   ├── events/                   # Events module (EventsView, TalkLiveChat presentation zoom/gating, EventPresenter 30s QR, SpeakerAvatar)
│   ├── home/                     # Home landing directory (HomeView recommendedIds, useLogoBackdrop luminance sampler)
│   ├── student/                  # Student profile, GeneratedCV, cv-download, StudentHistory
│   └── vacancies/                # Vacancy listing, VacancyFilters (5-mode sort), VacancyModal
├── lib/
│   ├── auth/                     # Course & workspace directory employee-ID mappings (course-directory.ts)
│   ├── data/                     # Canonical domain interfaces (types.ts), 43 programmes/12 study areas (course-map.ts), CSV exports (csv.ts), salary metadata, & Firestore access
│   └── theme/                    # QIU-Red design tokens (tokens.css)
├── public/                       # Static assets & country GeoJSON map
├── scripts/                      # Data processing scripts (generate_data.py)
├── tests/                        # Unit tests & Firestore security rules emulator tests
├── firebase.json                 # Firebase Hosting & emulator config
├── firestore.indexes.json        # Firestore composite index definitions
├── firestore.rules               # Server-side Firestore Security Rules v2
├── storage.rules                 # Firebase Storage Security Rules
├── next.config.ts                # Next.js static export config (output: 'export')
└── package.json                  # Dependencies & npm scripts
```

---

## Local Development & Setup

### Prerequisites

- **Node.js**: `22.13.0` or newer
- **npm**: Included with Node.js
- **Java Runtime Environment (JRE)**: Required for running the local Firestore Security Rules emulator test suite (`npm run test:rules`).

### 1. Installation

From the `webapp/` directory:

```bash
npm ci
```

### 2. Environment Configuration

Create a `.env.local` file by copying `.env.example`:

```bash
cp .env.example .env.local
```

Fill in your Firebase Web App project credentials:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## Development & Verification Commands

| Script Command | Description | Expected Output / Artifact |
| --- | --- | --- |
| `npm run dev` | Starts Next.js development server with hot-reloading | Server running at `http://localhost:3000` |
| `npm run build` | Compiles static site export bundle | Output generated in `webapp/out/` |
| `npm run start` | Serves compiled static build locally | Local preview via `npx serve out` |
| `npm run lint` | Runs ESLint syntax and code quality checks | Passes with zero errors |
| `npm test` | Builds app and runs unit/regression test suite | All test files in `tests/` pass |
| `npm run test:rules` | Launches Firestore Emulator & runs rules test suite | Rules assertions pass cleanly |

### Quality Gate Check before Commits

```bash
npm run lint
npm test
npm run test:rules
```

---

## Data Normalization & Initial Batch Import

Raw source datasets (`*.csv`, `*.xlsx`) must never be placed inside public web directories. To process and import vacancy data:

1. Execute the Python data normalization script to generate `data/jobs.json` (git-ignored):
   ```bash
   python3 scripts/generate_data.py
   ```
2. Log in as Superadmin (`ai@qiu.edu.my`).
3. Open **Admin Panel** -> **Initial Data Import**.
4. Upload `data/jobs.json` to seed or batch-update records in the Firestore `vacancies` collection.

---

## Firebase Deployment Procedure

To deploy security rules, composite database indexes, and static hosting to Firebase:

```bash
# Build static production export bundle
npm run build

# Deploy rules, indexes, and static assets
npx firebase-tools deploy --only firestore:rules,firestore:indexes,hosting
```

---

## Security Audit Protocol

Run this command before committing to verify that no environment files or source datasets are tracked by version control:

```bash
git ls-files -- data/jobs.json '*.csv' '*.xlsx' '*.xls' '*.tsv' '.env' '.env.local'
```

*Expected output: Empty output (no files returned).*
