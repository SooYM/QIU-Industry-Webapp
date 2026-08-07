"use client";

import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase-client";
import { fetchDirectoryProfile, PEOPLE_SCOPE } from "../lib/auth/course-directory";
import { revokeEmployerAccess, subscribeCompanies, submitSignup, subscribeMySignup } from "../lib/data/firestore";
import { AREAS_OF_STUDY } from "../lib/data/course-map";
import { downloadCsv, toCsv } from "../lib/data/csv";
import type { Company, EmployerSignup } from "../lib/data/types";
import { notify } from "../components/toast";
import {
  isAllowedAccessEmail,
  isAllowedQiuEmail,
  normalizeEmail,
  roleForEmail,
  SUPERADMIN_EMAIL,
  type UserRole,
} from "./auth-policy";

type AuthContextValue = {
  user: User | null;
  role: UserRole | null;
  course: string | null;
  employeeId: string | null;
  company: string | null;
  loading: boolean;
  error: string;
  needsRegistration: boolean; // signed-in non-QIU visitor who isn't whitelisted yet
  signIn: () => Promise<void>;
  /** Company reps: create an account, then verify by email before it works. */
  registerCompany: (input: { name: string; company: string; email: string; password: string }) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type UserRecord = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  course?: string;
  employeeId?: string;
  company?: string;
};

type WhitelistedEmailRecord = {
  id: string;
  email: string;
  role: UserRole;
  company?: string;
  addedBy?: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * What the registration form collected, parked until the rep has verified their
 * address and signed back in — at which point RegisterGate pre-fills from it.
 * The company details cannot be written to Firestore before then: the rules
 * require a verified account, which is what proves they own the inbox.
 */
const PENDING_SIGNUP_KEY = "industryday-pending-signup";

export function readPendingSignup(): { name?: string; company?: string } {
  try { return JSON.parse(window.localStorage.getItem(PENDING_SIGNUP_KEY) ?? "{}"); } catch { return {}; }
}
export function clearPendingSignup() {
  try { window.localStorage.removeItem(PENDING_SIGNUP_KEY); } catch { /* private mode */ }
}

function readableAuthError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("popup-closed-by-user")) return "Sign-in window closed before completion.";
  if (code.includes("popup-blocked")) return "Browser blocked the sign-in window. Allow pop-ups and try again.";
  if (code.includes("network-request-failed")) return "Could not reach Google sign-in. Check your connection and try again.";
  const msg = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  if (code.includes("missing-initial-state") || msg.includes("missing initial state")) {
    return "Your browser blocked the sign-in handshake (often in private mode or with strict tracking protection). Allow pop-ups and third-party cookies for this site, or try a normal Chrome window, then sign in again.";
  }
  return "Sign-in failed. Try again with your Google account.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [course, setCourse] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(isFirebaseConfigured ? "" : "Firebase has not been configured for this deployment.");

  useEffect(() => {
    if (!auth || !db) return;
    const activeAuth = auth;
    const activeDb = db;

    return onAuthStateChanged(activeAuth, async (nextUser) => {
      setLoading(true);
      setError("");
      if (!nextUser) {
        setUser(null);
        setRole(null);
        setCourse(null);
        setEmployeeId(null);
        setLoading(false);
        return;
      }

      let whitelisted: string[] = [];
      try {
        const email = normalizeEmail(nextUser.email);
        const whitelistSnap = email ? await getDoc(doc(activeDb, "whitelisted_emails", email)) : null;
        if (whitelistSnap?.exists() && whitelistSnap.data().active !== false) whitelisted = [email];
      } catch {
        // Fallback to empty whitelist if network or access check fails.
      }

      // Google accounts are always verified; a password account is not required
      // to be, because admin approval is the gate (see firestore.rules).
      const viaPassword = nextUser.providerData.some((p) => p.providerId === "password");
      if (!nextUser.emailVerified && !viaPassword) {
        await firebaseSignOut(activeAuth);
        setUser(null);
        setRole(null);
        setError("Please verify your Google account email, then sign in again.");
        setLoading(false);
        return;
      }

      // Non-QIU, not-yet-approved visitors are kept signed in so they can submit a
      // registration request (handled by AuthGate → RegisterGate) instead of being
      // turned away. Everything else in Firestore stays denied to them by the rules.
      if (!isAllowedAccessEmail(nextUser.email, whitelisted)) {
        setUser(nextUser);
        setRole(null);
        setCourse(null);
        setCompany(null);
        setNeedsRegistration(true);
        setLoading(false);
        return;
      }
      setNeedsRegistration(false);

      try {
        const userRef = doc(activeDb, "users", nextUser.uid);
        const snapshot = await getDoc(userRef);
        
        // Whitelisted external accounts can carry a role + company override.
        let defaultRole: UserRole = "user";
        let whitelistCompany: string | undefined;
        try {
          const whitelistDoc = await getDoc(doc(activeDb, "whitelisted_emails", normalizeEmail(nextUser.email)));
          if (whitelistDoc.exists()) {
            if (whitelistDoc.data()?.role) defaultRole = whitelistDoc.data()?.role as UserRole;
            if (whitelistDoc.data()?.company) whitelistCompany = whitelistDoc.data()?.company as string;
          }
        } catch {
          // Keep default
        }

        const nextRole = roleForEmail(nextUser.email, snapshot.data()?.role || defaultRole);
        const storedCompany = snapshot.data()?.company as string | undefined;
        const resolvedCompany = storedCompany ?? whitelistCompany;
        const profile = {
          displayName: nextUser.displayName ?? "",
          photoURL: nextUser.photoURL ?? "",
          updatedAt: serverTimestamp(),
        };
        if (snapshot.exists()) {
          await setDoc(userRef, { ...profile, ...(whitelistCompany && !storedCompany ? { company: whitelistCompany } : {}) }, { merge: true });
        } else {
          await setDoc(userRef, {
            ...profile,
            email: normalizeEmail(nextUser.email),
            role: nextRole,
            ...(resolvedCompany ? { company: resolvedCompany } : {}),
            createdAt: serverTimestamp(),
          });
        }
        setUser(nextUser);
        setRole(nextRole);
        setCompany(resolvedCompany ?? null);
        // onAuthStateChanged carries no OAuth token (e.g. page reload), so read the
        // course resolved during the last interactive sign-in from the stored doc.
        setCourse((snapshot.data()?.course as string) ?? null);
        setEmployeeId((snapshot.data()?.employeeId as string) ?? null);
      } catch (profileError: unknown) {
        // One sentence for every possible cause used to hide which one it was —
        // a denied write, an offline client and a real data fault all read the
        // same, and a rules regression took a round trip to identify. Say which.
        const code = (profileError as { code?: string })?.code ?? "";
        console.error("[auth] could not load or create the user profile:", code || profileError);

        const offline = code.includes("unavailable") || code.includes("network");
        if (offline) {
          // Transient: don't sign them out over a dropped connection.
          setError("Could not reach the portal. Check your connection and reload.");
        } else {
          await firebaseSignOut(activeAuth);
          setUser(null);
          setRole(null);
          setCourse(null);
          setCompany(null);
          setError(code === "permission-denied"
            ? `Your account is signed in but not approved for this portal (${code}). If an admin has just approved you, ask them to confirm your email is on the approved list, then sign in again.`
            : `Your account could not be checked${code ? ` (${code})` : ""}. Contact the QIU Industry Day portal administrator.`);
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    role,
    course,
    employeeId,
    company,
    loading,
    error,
    needsRegistration,
    signIn: async () => {
      if (!auth || !isFirebaseConfigured) {
        setError("Firebase has not been configured for this deployment.");
        return;
      }
      setError("");
      try {
        // Request the People/directory scope in THIS single, user-initiated popup.
        // A second popup (the old reauthenticateWithPopup) is blocked by the browser
        // because the click gesture is already spent — that "auth/popup-blocked" is
        // exactly why course/employee-ID capture silently failed. One popup fixes it.
        // The token from this result is then used for the QIU directory lookup only.
        const signInProvider = new GoogleAuthProvider();
        signInProvider.addScope(PEOPLE_SCOPE);
        signInProvider.setCustomParameters({ prompt: "select_account" });
        const result = await signInWithPopup(auth, signInProvider);
        if (isAllowedQiuEmail(result.user.email) && db) {
          try {
            const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
            if (token) {
              const { course: resolved, employeeId } = await fetchDirectoryProfile(token, result.user.email ?? undefined);
              const patch: Record<string, unknown> = {};
              // Only a recognised QIU programme counts. Staff/lecturers (or any
              // unmatched directory value) leave the course blank.
              if (resolved && resolved.code) { patch.course = resolved.name; patch.courseCode = resolved.code; }
              if (employeeId) patch.employeeId = employeeId;
              if (Object.keys(patch).length) await setDoc(doc(db, "users", result.user.uid), patch, { merge: true });
              if (resolved && resolved.code) setCourse(resolved.name);
              if (employeeId) setEmployeeId(employeeId);
            }
          } catch { /* Directory lookup is best-effort; never blocks sign-in. */ }
        }
      } catch (nextError) {
        setError(readableAuthError(nextError));
      }
    },
    registerCompany: async ({ name, company, email, password }) => {
      if (!auth || !isFirebaseConfigured) throw new Error("Firebase has not been configured for this deployment.");
      // Students and staff stay on Google. A qiu.edu.my address arriving through
      // email/password would be indistinguishable from a real student account,
      // and firestore.rules enforces the same split.
      if (isAllowedQiuEmail(email)) throw new Error("QIU accounts must use the Google button above.");

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() }).catch(() => {});

      // The registration request goes in HERE, in the same step. Asking again on
      // the next screen made a rep state their company twice for one action.
      // The admin fills in the logo, video and blurb when approving.
      await submitSignup(email, { name, company });

      // Kept only as a fallback: if the request above failed, RegisterGate shows
      // its form pre-filled instead of losing what they typed.
      try { window.localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({ name, company })); } catch { /* private mode */ }

      // No verification email: Firebase's mail does not reach several of the
      // providers these companies use, which locked every rep out. Admin
      // approval is the gate — the account can read nothing until an admin
      // whitelists it. firestore.rules carries the same note.
    },
    signInWithPassword: async (email: string, password: string) => {
      if (!auth || !isFirebaseConfigured) throw new Error("Firebase has not been configured for this deployment.");
      // An unverified account is routed to the verification gate by the
      // auth-state handler; it is not an error worth throwing at the form.
      await signInWithEmailAndPassword(auth, email, password);
    },
    resetPassword: async (email: string) => {
      if (!auth || !isFirebaseConfigured) throw new Error("Firebase has not been configured for this deployment.");
      await sendPasswordResetEmail(auth, email);
    },
    signOut: async () => {
      if (auth) await firebaseSignOut(auth);
    },
  }), [company, course, employeeId, error, loading, needsRegistration, role, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

/**
 * Company representatives register with an email address and a password. They
 * are NOT put on Google: many companies run their own mail server and have no
 * Google account at all.
 *
 * Registering does not grant access. It creates a verified identity; the
 * company details then go to an admin, who approves and links the account to a
 * company (see RegisterGate and the Access control panel).
 */
function CompanyAuth() {
  const { registerCompany, signInWithPassword, resetPassword } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">("register");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setProblem("");
    setDone("");

    if (mode === "register" && password !== confirm) { setProblem("The two passwords do not match."); return; }
    if (mode === "register" && password.length < 8) { setProblem("Use at least 8 characters for your password."); return; }

    setBusy(true);
    try {
      if (mode === "register") {
        await registerCompany({ name, company, email: email.trim().toLowerCase(), password });
        // The auth-state handler takes over and shows the registration form,
        // pre-filled with the company entered above.
      } else {
        await signInWithPassword(email.trim().toLowerCase(), password);
      }
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : readableAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) { setProblem("Enter your email address first, then choose Forgot password."); return; }
    setProblem("");
    try {
      await resetPassword(email.trim().toLowerCase());
      setDone(`Password reset link sent to ${email.trim().toLowerCase()}.`);
    } catch (err: unknown) {
      setProblem(err instanceof Error ? err.message : readableAuthError(err));
    }
  };

  return (
    <div className="company-auth">
      <div className="company-auth-switch" role="tablist" aria-label="Company account">
        <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => { setMode("register"); setProblem(""); }}>Register</button>
        <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "is-active" : ""} onClick={() => { setMode("signin"); setProblem(""); }}>Sign in</button>
      </div>

      <form className="company-auth-form" onSubmit={submit}>
        {mode === "register" && (
          <>
            <label className="register-field">Your name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} autoComplete="name" /></label>
            <label className="register-field">Company you represent<input value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={200} placeholder="e.g. Acme Sdn Bhd" autoComplete="organization" /></label>
          </>
        )}
        <label className="register-field">Work email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@yourcompany.com" autoComplete="email" /></label>
        <label className="register-field">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "register" ? "new-password" : "current-password"} /></label>
        {mode === "register" && (
          <label className="register-field">Confirm password<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
        )}

        {problem && <p className="auth-error" role="alert">{problem}</p>}
        {done && <p className="auth-note" role="status">{done}</p>}

        <button className="google-sign-in" type="submit" disabled={busy || !isFirebaseConfigured}>
          {busy ? "Working…" : mode === "register" ? "Create company account" : "Sign in"}
        </button>
        {mode === "signin" && (
          <button className="auth-secondary" type="button" onClick={forgot}>Forgot password</button>
        )}
        <small className="auth-boundary">
          {mode === "register"
            ? "That is the whole registration. An admin reviews your request, sets up the company profile, and grants you access to add and edit vacancies."
            : "New here? Choose Register above."}
        </small>
      </form>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, error, needsRegistration, signIn } = useAuth();

  if (loading) return <AuthStatus title="Checking access" detail="Confirming your account permissions…" loading />;
  if (!user) {
    return <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="brand auth-brand" href="#" aria-label="QIU Industry Day 2026"><img className="brand-logo" src="/qiu-logo.png" alt="QIU" /><span>Industry <span>Day 2026</span></span><small>PORTAL</small></a>
        <div className="auth-copy"><span className="detail-label">PORTAL ACCESS</span><h1 id="auth-title">Sign in to the Industry Day portal</h1><p>Students and staff sign in with their QIU Google account. Company representatives register below with an email address and a password.</p></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="google-sign-in" type="button" onClick={signIn} disabled={!isFirebaseConfigured}><GoogleMark />Continue with QIU Google</button>
        <div className="auth-choice" aria-hidden="true"><span>Company representative</span></div>
        <CompanyAuth />
      </section>
    </main>;
  }
  if (needsRegistration) return <RegisterGate />;
  return <>{children}</>;
}

/** Non-QIU visitor: submit an employer registration, then wait for admin approval. */
const REGISTER_ALL_STUDENTS = "All students";

function RegisterGate() {
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";
  const [signup, setSignup] = useState<EmployerSignup | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Pre-filled from what they typed at registration — they should not have to
  // state their company twice just because verification happened in between.
  const draft = typeof window === "undefined" ? {} : readPendingSignup();
  const [name, setName] = useState(user?.displayName ?? draft.name ?? "");
  const [companyName, setCompanyName] = useState(draft.company ?? "");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [summary, setSummary] = useState("");
  const [interestedIn, setInterestedIn] = useState(""); // comma-separated areas of study / "All students"
  // Already-picked areas drop out of the dropdown.
  const registerChosen = new Set(interestedIn.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Latch: once a submit is accepted by the server, stay on the pending screen
  // even if a later snapshot momentarily returns null (transient listen error /
  // optimistic-write race) — otherwise the form would wrongly reappear.
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!email) return;
    // A null snapshot never clears a locally-latched submission.
    return subscribeMySignup(email, (s) => { if (s) setSignup(s); setLoaded(true); });
  }, [email]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !companyName.trim()) { setMessage("Your name and company are required."); return; }
    setBusy(true);
    // await resolves only after the server accepts the write, so it has persisted.
    try { await submitSignup(email, { name, company: companyName, contact, website, summary, interestedIn: interestedIn.split(",").map((s) => s.trim()).filter(Boolean) }); clearPendingSignup(); setSubmitted(true); setMessage(""); notify("Registration submitted for admin approval.", "info"); }
    catch { setMessage("Could not submit your registration. Please try again."); notify("Could not submit registration.", "error"); }
    finally { setBusy(false); }
  }

  const pending = submitted || (signup !== null && signup.status === "pending");
  const pendingName = (signup?.name || name || email).split(" ")[0];
  const pendingCompany = signup?.company || companyName;

  return <main className="auth-screen"><section className="auth-card" aria-labelledby="register-title">
    <a className="brand auth-brand" href="#" aria-label="QIU Industry Day 2026"><img className="brand-logo" src="/qiu-logo.png" alt="QIU" /><span>Industry <span>Day 2026</span></span></a>
    {!loaded && !pending ? <p className="auth-status" role="status">Loading…</p>
      : pending ? (
        <div className="auth-copy">
          <span className="detail-label">⏳ WAITING FOR APPROVAL</span>
          <h1 id="register-title">Thanks, {pendingName} — you&apos;re in the queue</h1>
          <p>We&apos;ve received your registration{pendingCompany ? <> for <b>{pendingCompany}</b></> : ""}. Its status is <b>Pending</b>. An admin will set up the company profile and approve your access — sign in again after that and you can add and edit vacancies. Nothing else is needed from you now.</p>
          <p style={{ marginTop: ".5rem" }}><span className="rounded px-1.5 py-0.5 text-[11px] font-bold tone-neutral">Pending approval</span></p>
          <button className="google-sign-in" type="button" onClick={signOut} style={{ marginTop: "1rem" }}>Sign out</button>
        </div>
      ) : (
        <form onSubmit={submit} className="auth-copy">
          <span className="detail-label">COMPANY REGISTRATION</span>
          <h1 id="register-title">Register your company</h1>
          <p>Signed in as <b>{email}</b>. Confirm your company details. An admin reviews them, adds your logo and corporate video, and approves — after that you can add and edit vacancies.</p>
          <label className="register-field">Your name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} /></label>
          <label className="register-field">Company name<input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required maxLength={200} placeholder="e.g. Acme Sdn Bhd" /></label>
          <label className="register-field">Website <small>optional</small><input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={2048} placeholder="https://acme.com" /></label>
          <label className="register-field">Contact (phone / email) <small>optional</small><input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} /></label>
          <label className="register-field">Students you are looking for <small>optional — these students see your profile recommended</small>
            <select value="" onChange={(e) => {
              const val = e.target.value;
              e.target.value = "";
              if (!val) return;
              if (val === REGISTER_ALL_STUDENTS) { setInterestedIn(REGISTER_ALL_STUDENTS); return; }
              const cur = interestedIn.split(",").map((s) => s.trim()).filter((s) => s && s.toLowerCase() !== REGISTER_ALL_STUDENTS.toLowerCase());
              setInterestedIn(Array.from(new Set([...cur, val])).join(", "));
            }}>
              <option value="" disabled>＋ Add an area of study…</option>
              {!registerChosen.has(REGISTER_ALL_STUDENTS.toLowerCase()) && <option value={REGISTER_ALL_STUDENTS}>⭐ All students (recommend to everyone)</option>}
              {AREAS_OF_STUDY.filter((a) => !registerChosen.has(a.toLowerCase())).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {interestedIn.trim() && (
              <div className="selected-chip-row">
                {interestedIn.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                  <span key={s} className="selected-chip">{s}<button type="button" aria-label={`Remove ${s}`} onClick={() => setInterestedIn(interestedIn.split(",").map((x) => x.trim()).filter((x) => x && x !== s).join(", "))}>✕</button></span>
                ))}
              </div>
            )}
          </label>
          <label className="register-field">Company profile / blurb <small>optional</small><textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={5000} /></label>
          {message && <p className="auth-error" role="alert">{message}</p>}
          <button className="google-sign-in" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit registration"}</button>
          <button className="auth-secondary" type="button" onClick={signOut}>Cancel &amp; sign out</button>
        </form>
      )}
  </section></main>;
}

function AuthStatus({ title, detail, loading = false }: { title: string; detail: string; loading?: boolean }) {
  return <main className="auth-screen"><section className="auth-card auth-status" role="status" aria-live="polite">
    <img className="brand-logo auth-status-logo" src="/qiu-logo.png" alt="QIU" />{loading && <span className="auth-progress" aria-hidden="true" />}
    <h1>{title}</h1><p>{detail}</p>
  </section></main>;
}

export function AuthAccount() {
  const { user, role, course, employeeId, signOut } = useAuth();
  const [photoOk, setPhotoOk] = useState(true);
  if (!user || !role) return null;
  const subtitle = role === "superadmin" ? "Super admin"
    : role === "admin" ? "Admin"
    : role === "employer" ? "Company"
    : (course || ""); // students see their course; staff/unmatched stay blank
  return <div className="auth-account">
    {user.photoURL && photoOk
      ? <img className="auth-photo" src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setPhotoOk(false)} />
      : <span className="auth-avatar" aria-hidden="true">{(user.displayName || user.email || "Q").charAt(0).toUpperCase()}</span>}
    <span><strong>{user.displayName || user.email}</strong><small>{subtitle}</small>{employeeId && <small className="auth-empid">ID {employeeId}</small>}</span>
    <button type="button" onClick={signOut}>Sign out</button>
  </div>;
}

export function RoleManager() {
  const { role, user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [whitelistedEmails, setWhitelistedEmails] = useState<WhitelistedEmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("employer");
  const [newCompany, setNewCompany] = useState("");
  const [userQuery, setUserQuery] = useState("");
  // Which approved row is being re-assigned, and to what.
  const [editingEmail, setEditingEmail] = useState("");
  const [editingCompany, setEditingCompany] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);

  const canManageRoles = role === "superadmin" || role === "admin";
  useEffect(() => {
    if (!canManageRoles || !db) return;
    const activeDb = db;

    const loadUsers = getDocs(collection(activeDb, "users")).then((snapshot) =>
      setUsers(snapshot.docs.map((entry) => ({
        uid: entry.id,
        email: entry.data().email ?? "",
        displayName: entry.data().displayName ?? "",
        photoURL: entry.data().photoURL ?? "",
        role: roleForEmail(entry.data().email, entry.data().role),
        course: entry.data().course ?? "",
        employeeId: entry.data().employeeId ?? "",
        company: entry.data().company ?? "",
      })).sort((a, b) => a.email.localeCompare(b.email)))
    );

    // Live, not a one-shot read: changing a role elsewhere on this screen left
    // these rows showing the old value until a reload.
    const unsubWhitelist = onSnapshot(collection(activeDb, "whitelisted_emails"), (snapshot) => {
      setWhitelistedEmails(snapshot.docs.filter((entry) => entry.data().active !== false).map((entry) => ({
        id: entry.id,
        email: entry.data().email ?? entry.id,
        role: (entry.data().role as UserRole) || "employer",
        company: entry.data().company ?? "",
        addedBy: entry.data().addedBy ?? "",
      })));
      setLoading(false);
    }, () => setMessage("Could not load the approved account list."));

    const unsubCompanies = subscribeCompanies(setCompanies, () => {});

    loadUsers
      .catch(() => setMessage("Could not load account management data."))
      .finally(() => setLoading(false));

    return () => { unsubWhitelist(); unsubCompanies(); };
  }, [canManageRoles]);

  if (!canManageRoles) return null;

  async function assignRole(record: UserRecord, nextRole: UserRole) {
    if (!db || normalizeEmail(record.email) === SUPERADMIN_EMAIL) return;
    setMessage("");
    try {
      await updateDoc(doc(db, "users", record.uid), { role: nextRole, updatedAt: serverTimestamp() });
      setUsers((current) => current.map((item) => item.uid === record.uid ? { ...item, role: nextRole } : item));
      // Whitelisted accounts read their role from the whitelist on a fresh sign-in,
      // so leaving it behind would silently revert the change.
      const listed = whitelistedEmails.find((w) => w.id === normalizeEmail(record.email));
      if (listed) {
        await setDoc(doc(db, "whitelisted_emails", listed.id), { role: nextRole, updatedAt: serverTimestamp() }, { merge: true });
      }
      setMessage(`${record.email} is now ${nextRole}.`);
      notify(`${record.email} is now ${nextRole}.`);
    } catch {
      setMessage(`Could not update ${record.email}.`);
      notify(`Could not update ${record.email}.`, "error");
    }
  }

  async function addWhitelistedEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !newEmail.trim()) return;
    const emailToSave = normalizeEmail(newEmail);
    setMessage("");
    try {
      const company = newRole === "employer" ? newCompany.trim() : "";
      await setDoc(doc(db, "whitelisted_emails", emailToSave), {
        email: emailToSave,
        role: newRole,
        active: true,
        ...(company ? { company } : {}),
        addedBy: normalizeEmail(user?.email),
        createdAt: serverTimestamp(),
      });
      setWhitelistedEmails((prev) => [...prev.filter((item) => item.id !== emailToSave), { id: emailToSave, email: emailToSave, role: newRole, company }]);
      setNewEmail("");
      setNewCompany("");
      setMessage(`Whitelisted non-QIU account ${emailToSave} with role ${newRole}${company ? ` (${company})` : ""}.`);
      notify(`Approved ${emailToSave} as ${newRole}.`);
    } catch {
      setMessage(`Could not whitelist ${emailToSave}.`);
      notify(`Could not approve ${emailToSave}.`, "error");
    }
  }

  /**
   * Re-assigns which company an approved account represents.
   *
   * Writes both the whitelist entry (the source of truth an admin edits) and the
   * account's own user document, so the change takes effect on their next page
   * load rather than waiting for a fresh sign-in to copy it across.
   */
  async function assignCompany(record: WhitelistedEmailRecord) {
    if (!db) return;
    const company = editingCompany.trim();
    if (!company) { setMessage("Enter a company name first."); return; }
    setMessage("");
    try {
      await setDoc(doc(db, "whitelisted_emails", record.id), {
        company, role: "employer", active: true, updatedAt: serverTimestamp(),
      }, { merge: true });

      const account = users.find((u) => normalizeEmail(u.email) === record.id);
      if (account) {
        await updateDoc(doc(db, "users", account.uid), { company, role: "employer", updatedAt: serverTimestamp() });
        setUsers((current) => current.map((u) => u.uid === account.uid ? { ...u, role: "employer" } : u));
      }

      setWhitelistedEmails((prev) => prev.map((item) => item.id === record.id ? { ...item, company, role: "employer" } : item));
      setEditingEmail("");
      setEditingCompany("");
      setMessage(`${record.email} now represents ${company}.`);
      notify(`${record.email} assigned to ${company}.`);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      setMessage(`Could not assign a company to ${record.email}${code ? ` (${code})` : ""}.`);
      notify("Could not assign the company.", "error");
    }
  }

  async function removeWhitelistedEmail(record: WhitelistedEmailRecord) {
    if (!db) return;
    const scope = record.company ? ` This permanently deletes ${record.company}'s company profile and every vacancy listing.` : " This permanently deletes company profiles and vacancy listings owned by this account.";
    if (!confirm(`Revoke access for ${record.email}?${scope}`)) return;
    setMessage("");
    try {
      const removed = await revokeEmployerAccess(record.email, record.company);
      setWhitelistedEmails((prev) => prev.filter((item) => item.id !== record.id));
      setMessage(`Revoked ${record.email}; deleted ${removed.profiles} profile and ${removed.vacancies} vacancies.`);
      notify(`Access revoked for ${record.email}.`);
    } catch {
      setMessage(`Could not revoke ${record.email}. No access changes were applied.`);
      notify(`Could not revoke ${record.email}.`, "error");
    }
  }

  // Assignments must point at a company that actually exists, otherwise the rep
  // gets employer access with no profile to edit. An already-assigned name that
  // is no longer in the list is kept so it is not silently dropped.
  const companyOptions = [...new Set([
    ...companies.map((c) => c.name).filter(Boolean),
    ...whitelistedEmails.map((w) => w.company).filter((name): name is string => Boolean(name)),
  ])].sort((a, b) => a.localeCompare(b));

  return (
    <section className="role-manager space-y-6" aria-labelledby="role-manager-title">
      <div className="role-manager-head">
        <div>
          <span className="detail-label">ACCESS CONTROL</span>
          <h3 id="role-manager-title">Portal User Roles & Whitelisted Accounts</h3>
        </div>
        <div className="flex items-center gap-2">
          <small>{users.length} registered accounts</small>
          <button type="button" className="admin-button" onClick={() => {
            if (!users.length) { notify("Nothing to export.", "error"); return; }
            const rows = users.map((u) => [u.displayName, u.email, u.role, u.employeeId ?? "", u.course ?? "", u.company ?? ""]);
            downloadCsv(`accounts-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["Name", "Email", "Role", "Employee ID", "Course", "Company"], rows));
            notify(`Exported ${users.length} account${users.length === 1 ? "" : "s"}.`);
          }} disabled={!users.length}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Admins & superadmin can approve external (non-QIU) accounts and set the
          employer's company. Collapsed by default, themed like the rest of the panel. */}
      {canManageRoles && (
        <details className="access-approve panel-accent">
          <summary><span>➕ Approve Non-@qiu.edu.my account</span><small>{whitelistedEmails.length} approved</small></summary>
          <div className="access-approve-body">
            <p>By default, non-QIU emails cannot log in. Approve company representatives or external admins here. For a company account, set which company it represents.</p>
            <form onSubmit={addWhitelistedEmail} className="access-approve-form">
              <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="e.g. representative@company.com" />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
                <option value="employer">Company (Own Vacancies Only)</option>
                <option value="admin">Admin (All Jobs)</option>
                <option value="user">User / Student (Browse Only)</option>
              </select>
              {newRole === "employer" && (
                <input type="text" required value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Company name" />
              )}
              <button type="submit" className="save-job">Approve external email</button>
            </form>
            {whitelistedEmails.length > 0 && (
              <div className="access-approved-list">
                <span className="detail-label">Approved external accounts ({whitelistedEmails.length})</span>
                {whitelistedEmails.map((item) => (
                  <div key={item.id} className="access-approved-row">
                    <span>{item.email} <span className="role-pill">{item.role}</span>{item.company ? <small> · {item.company}</small> : <small> · no company assigned</small>}</span>
                    {editingEmail === item.id ? (
                      <span className="access-assign">
                        <select
                          value={editingCompany}
                          onChange={(e) => setEditingCompany(e.target.value)}
                          aria-label={`Company for ${item.email}`}
                          autoFocus
                        >
                          <option value="">Select a company…</option>
                          {companyOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <button type="button" className="save-job" onClick={() => assignCompany(item)}>Save</button>
                        <button type="button" className="auth-secondary" onClick={() => setEditingEmail("")}>Cancel</button>
                      </span>
                    ) : (
                      <span className="access-assign">
                        <button type="button" className="admin-button" onClick={() => { setEditingEmail(item.id); setEditingCompany(item.company ?? ""); }}>
                          {item.company ? "Change company" : "Assign company"}
                        </button>
                        <button type="button" className="access-revoke" onClick={() => removeWhitelistedEmail(item)}>Revoke and delete company</button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      <p>Users can browse. Companies can manage their own vacancies. Admins can manage all vacancies. Superadmin identity is fixed. Approve new company registrations in the Approvals tab.</p>
      <input type="search" className="admin-search" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Search accounts by name or email…" aria-label="Search accounts" />
      {loading ? (
        <p className="role-manager-state" role="status">Loading accounts…</p>
      ) : (
        <div className="role-list">
          {users.filter((record) => { const s = userQuery.trim().toLowerCase(); return !s || (record.displayName ?? "").toLowerCase().includes(s) || (record.email ?? "").toLowerCase().includes(s); }).map((record) => {
            const fixed = normalizeEmail(record.email) === SUPERADMIN_EMAIL;
            return (
              <div className="role-row" key={record.uid}>
                <span className="auth-avatar" aria-hidden="true">{(record.displayName || record.email || "Q").charAt(0).toUpperCase()}</span>
                <span><strong>{record.displayName || record.email}</strong>{record.displayName && <small>{record.email}</small>}</span>
                {fixed ? (
                  <span className="fixed-role">Super admin</span>
                ) : (
                  <label>
                    <span className="sr-only">Role for {record.email}</span>
                    <select value={record.role} onChange={(event) => assignRole(record, event.target.value as UserRole)}>
                      <option value="user">User / Student</option>
                      <option value="employer">Company</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
      {message && <p className="role-manager-message" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}

function GoogleMark() {
  return <svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.59-5.04-3.72H.95v2.33A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.96 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.95a9 9 0 0 0 0 8.06l3.01-2.33Z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15.02 2.35A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .95 4.97L3.96 7.3C4.67 5.17 6.66 3.58 9 3.58Z"/></svg>;
}

export type { UserRole } from "./auth-policy";
