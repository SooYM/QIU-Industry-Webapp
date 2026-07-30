"use client";

import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase-client";
import { fetchDirectoryCourse, PEOPLE_SCOPE } from "../lib/auth/course-directory";
import { submitSignup, subscribeMySignup } from "../lib/data/firestore";
import type { EmployerSignup } from "../lib/data/types";
import { ImagePreview } from "../components/ImagePreview";
import {
  isAllowedAccessEmail,
  isAllowedQiuEmail,
  logoFromWebsite,
  normalizeEmail,
  roleForEmail,
  SUPERADMIN_EMAIL,
  type UserRole,
} from "./auth-policy";

type AuthContextValue = {
  user: User | null;
  role: UserRole | null;
  course: string | null;
  company: string | null;
  loading: boolean;
  error: string;
  needsRegistration: boolean; // signed-in non-QIU visitor who isn't whitelisted yet
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

type UserRecord = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
};

type WhitelistedEmailRecord = {
  id: string;
  email: string;
  role: UserRole;
  company?: string;
  addedBy?: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);
// Base provider carries NO sensitive scopes, so non-QIU sign-in never triggers the
// "unverified app" consent. The People API directory scope is requested
// incrementally in signIn(), only for @qiu.edu.my accounts.
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

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
        setLoading(false);
        return;
      }

      let whitelisted: string[] = [];
      try {
        const whitelistSnap = await getDocs(collection(activeDb, "whitelisted_emails"));
        // A revoked entry (active === false) no longer grants access.
        whitelisted = whitelistSnap.docs.filter((doc) => doc.data().active !== false).map((doc) => normalizeEmail(doc.data().email || doc.id));
      } catch {
        // Fallback to empty whitelist if network fails
      }

      if (!nextUser.emailVerified) {
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
      } catch {
        await firebaseSignOut(activeAuth);
        setError("Your account could not be checked. Contact the QIU Industry Day portal administrator.");
        setUser(null);
        setRole(null);
        setCourse(null);
        setCompany(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    role,
    course,
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
        const result = await signInWithPopup(auth, provider);
        // Course auto-detection is for @qiu.edu.my students only. Request the
        // People API directory scope INCREMENTALLY here, so non-QIU accounts never
        // see the sensitive-scope "unverified app" consent. Best-effort — a failed
        // or dismissed lookup never blocks sign-in.
        if (isAllowedQiuEmail(result.user.email) && db) {
          try {
            const scoped = new GoogleAuthProvider();
            scoped.addScope(PEOPLE_SCOPE);
            const scopedResult = await reauthenticateWithPopup(result.user, scoped);
            const token = GoogleAuthProvider.credentialFromResult(scopedResult)?.accessToken;
            if (token) {
              const resolved = await fetchDirectoryCourse(token);
              // Only a recognised QIU programme counts. Staff/lecturers (or any
              // unmatched directory value) leave the course blank.
              if (resolved && resolved.code) {
                await setDoc(doc(db, "users", result.user.uid), { course: resolved.name, courseCode: resolved.code }, { merge: true });
                setCourse(resolved.name);
              }
            }
          } catch { /* Directory lookup is best-effort; keep the stored course. */ }
        }
      } catch (nextError) {
        setError(readableAuthError(nextError));
      }
    },
    signOut: async () => {
      if (auth) await firebaseSignOut(auth);
    },
  }), [company, course, error, loading, needsRegistration, role, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, error, needsRegistration, signIn } = useAuth();

  if (loading) return <AuthStatus title="Checking access" detail="Confirming your account permissions…" loading />;
  if (!user) {
    return <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="brand auth-brand" href="#" aria-label="QIU Industry Day 2026"><img className="brand-logo" src="/qiu-logo.png" alt="QIU" /><span>Industry <span>Day 2026</span></span><small>PORTAL</small></a>
        <div className="auth-copy"><span className="detail-label">PORTAL ACCESS</span><h1 id="auth-title">Sign in to the Industry Day portal</h1><p>Students &amp; staff: use your @qiu.edu.my Google account. Companies: sign in with any Google account and register to attend.</p></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="google-sign-in" type="button" onClick={signIn} disabled={!isFirebaseConfigured}><GoogleMark />Continue with Google account</button>
        <small className="auth-boundary">QIU accounts get in instantly · external companies register for admin approval</small>
      </section>
    </main>;
  }
  if (needsRegistration) return <RegisterGate />;
  return <>{children}</>;
}

/** Non-QIU visitor: submit an employer registration, then wait for admin approval. */
function RegisterGate() {
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";
  const [signup, setSignup] = useState<EmployerSignup | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(user?.displayName ?? "");
  const [companyName, setCompanyName] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!email) return;
    return subscribeMySignup(email, (s) => { setSignup(s); setLoaded(true); });
  }, [email]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !companyName.trim()) { setMessage("Your name and company are required."); return; }
    setBusy(true);
    try { await submitSignup(email, { name, company: companyName, contact, website, logoUrl, videoUrl, summary }); setMessage(""); }
    catch { setMessage("Could not submit your registration. Please try again."); }
    finally { setBusy(false); }
  }

  const pending = signup && signup.status === "pending";

  return <main className="auth-screen"><section className="auth-card" aria-labelledby="register-title">
    <a className="brand auth-brand" href="#" aria-label="QIU Industry Day 2026"><img className="brand-logo" src="/qiu-logo.png" alt="QIU" /><span>Industry <span>Day 2026</span></span></a>
    {!loaded ? <p className="auth-status" role="status">Loading…</p>
      : pending ? (
        <div className="auth-copy">
          <span className="detail-label">REGISTRATION RECEIVED</span>
          <h1 id="register-title">Thanks, {signup!.name.split(" ")[0]} — you&apos;re in the queue</h1>
          <p>We&apos;ve received your registration for <b>{signup!.company}</b>. An admin will review and approve it shortly. You&apos;ll get employer access on your next sign-in after approval.</p>
          <button className="google-sign-in" type="button" onClick={signOut} style={{ marginTop: "1rem" }}>Sign out</button>
        </div>
      ) : (
        <form onSubmit={submit} className="auth-copy">
          <span className="detail-label">COMPANY REGISTRATION</span>
          <h1 id="register-title">Register your company</h1>
          <p>Signed in as <b>{email}</b>. Fill in your company profile — once an admin approves, it appears on the Home page and you can add vacancies.</p>
          <label className="register-field">Your name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} /></label>
          <label className="register-field">Company name<input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required maxLength={200} placeholder="e.g. Acme Sdn Bhd" /></label>
          <label className="register-field">Website <small>optional</small><input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={2048} placeholder="https://acme.com" /></label>
          <label className="register-field">Logo image URL <small>optional</small>
            <span className="register-logo-row"><input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} maxLength={2048} placeholder="https://…/logo.png" /><button type="button" className="auth-secondary register-logo-btn" onClick={() => setLogoUrl(logoFromWebsite(website))} disabled={!website.trim()}>From website</button></span>
          </label>
          <ImagePreview url={logoUrl} label="Logo preview" />
          <label className="register-field">Corporate video (YouTube) <small>optional</small><input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} maxLength={2048} placeholder="https://youtube.com/watch?v=…" /></label>
          <label className="register-field">Contact (phone / email) <small>optional</small><input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} /></label>
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
  const { user, role, course, signOut } = useAuth();
  if (!user || !role) return null;
  const subtitle = role === "superadmin" ? "Super admin"
    : role === "admin" ? "Admin"
    : role === "employer" ? "Employer"
    : (course || ""); // students see their course; staff/unmatched stay blank
  return <div className="auth-account">
    <span className="auth-avatar" aria-hidden="true">{(user.displayName || user.email || "Q").charAt(0).toUpperCase()}</span>
    <span><strong>{user.displayName || user.email}</strong><small>{subtitle}</small></span>
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
      })).sort((a, b) => a.email.localeCompare(b.email)))
    );

    const loadWhitelist = getDocs(collection(activeDb, "whitelisted_emails")).then((snapshot) =>
      setWhitelistedEmails(snapshot.docs.filter((entry) => entry.data().active !== false).map((entry) => ({
        id: entry.id,
        email: entry.data().email ?? entry.id,
        role: (entry.data().role as UserRole) || "employer",
        company: entry.data().company ?? "",
        addedBy: entry.data().addedBy ?? "",
      })))
    );

    Promise.all([loadUsers, loadWhitelist])
      .catch(() => setMessage("Could not load account management data."))
      .finally(() => setLoading(false));
  }, [canManageRoles]);

  if (!canManageRoles) return null;

  async function assignRole(record: UserRecord, nextRole: UserRole) {
    if (!db || normalizeEmail(record.email) === SUPERADMIN_EMAIL) return;
    setMessage("");
    try {
      await updateDoc(doc(db, "users", record.uid), { role: nextRole, updatedAt: serverTimestamp() });
      setUsers((current) => current.map((item) => item.uid === record.uid ? { ...item, role: nextRole } : item));
      setMessage(`${record.email} is now ${nextRole}.`);
    } catch {
      setMessage(`Could not update ${record.email}.`);
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
        ...(company ? { company } : {}),
        addedBy: normalizeEmail(user?.email),
        createdAt: serverTimestamp(),
      });
      setWhitelistedEmails((prev) => [...prev.filter((item) => item.id !== emailToSave), { id: emailToSave, email: emailToSave, role: newRole, company }]);
      setNewEmail("");
      setNewCompany("");
      setMessage(`Whitelisted non-QIU account ${emailToSave} with role ${newRole}${company ? ` (${company})` : ""}.`);
    } catch {
      setMessage(`Could not whitelist ${emailToSave}.`);
    }
  }

  async function removeWhitelistedEmail(emailId: string) {
    if (!db) return;
    setMessage("");
    try {
      await setDoc(doc(db, "whitelisted_emails", emailId), { active: false }, { merge: true });
      // Delete doc
      setWhitelistedEmails((prev) => prev.filter((item) => item.id !== emailId));
      setMessage(`Removed ${emailId} from whitelist.`);
    } catch {
      setMessage(`Could not remove ${emailId}.`);
    }
  }

  return (
    <section className="role-manager space-y-6" aria-labelledby="role-manager-title">
      <div className="role-manager-head">
        <div>
          <span className="detail-label">ACCESS CONTROL</span>
          <h3 id="role-manager-title">Portal User Roles & Whitelisted Accounts</h3>
        </div>
        <small>{users.length} registered accounts</small>
      </div>

      {/* Admins & superadmin can approve external (non-QIU) accounts and set the
          employer's company. Collapsed by default, themed like the rest of the panel. */}
      {canManageRoles && (
        <details className="access-approve panel-accent">
          <summary><span>➕ Approve Non-@qiu.edu.my account</span><small>{whitelistedEmails.length} approved</small></summary>
          <div className="access-approve-body">
            <p>By default, non-QIU emails cannot log in. Approve external emails (e.g. Employers or External Admins) here. For an employer, set which company they represent.</p>
            <form onSubmit={addWhitelistedEmail} className="access-approve-form">
              <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="e.g. employer@company.com" />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
                <option value="employer">Employer (Own Jobs Only)</option>
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
                    <span>{item.email} <span className="role-pill">{item.role}</span>{item.company ? <small> · {item.company}</small> : null}</span>
                    <button type="button" className="access-revoke" onClick={() => removeWhitelistedEmail(item.id)}>Revoke</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      <p>Users can browse. Employers can manage their own jobs. Admins can manage all jobs. Superadmin identity is fixed. Approve new company registrations in the Approvals tab.</p>
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
                      <option value="employer">Employer</option>
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
