"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase-client";
import {
  isAllowedQiuEmail,
  normalizeEmail,
  roleForEmail,
  SUPERADMIN_EMAIL,
  type UserRole,
} from "./auth-policy";

type AuthContextValue = {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  error: string;
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

const AuthContext = createContext<AuthContextValue | null>(null);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ hd: "qiu.edu.my", prompt: "select_account" });

function readableAuthError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code.includes("popup-closed-by-user")) return "Sign-in window closed before completion.";
  if (code.includes("popup-blocked")) return "Browser blocked the sign-in window. Allow pop-ups and try again.";
  if (code.includes("network-request-failed")) return "Could not reach Google sign-in. Check your connection and try again.";
  return "Sign-in failed. Try again with your QIU Google account.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
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
        setLoading(false);
        return;
      }

      if (!nextUser.emailVerified || !isAllowedQiuEmail(nextUser.email)) {
        await firebaseSignOut(activeAuth);
        setUser(null);
        setRole(null);
        setError("Access is limited to verified @qiu.edu.my Google accounts.");
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(activeDb, "users", nextUser.uid);
        const snapshot = await getDoc(userRef);
        const nextRole = roleForEmail(nextUser.email, snapshot.data()?.role);
        const profile = {
          displayName: nextUser.displayName ?? "",
          photoURL: nextUser.photoURL ?? "",
          updatedAt: serverTimestamp(),
        };
        if (snapshot.exists()) {
          await setDoc(userRef, profile, { merge: true });
        } else {
          await setDoc(userRef, {
            ...profile,
            email: normalizeEmail(nextUser.email),
            role: nextRole,
            createdAt: serverTimestamp(),
          });
        }
        setUser(nextUser);
        setRole(nextRole);
      } catch {
        await firebaseSignOut(activeAuth);
        setError("Your account could not be checked. Contact the VacancyPortal administrator.");
        setUser(null);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    role,
    loading,
    error,
    signIn: async () => {
      if (!auth || !isFirebaseConfigured) {
        setError("Firebase has not been configured for this deployment.");
        return;
      }
      setError("");
      try {
        await signInWithPopup(auth, provider);
      } catch (nextError) {
        setError(readableAuthError(nextError));
      }
    },
    signOut: async () => {
      if (auth) await firebaseSignOut(auth);
    },
  }), [error, loading, role, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, error, signIn } = useAuth();

  if (loading) return <AuthStatus title="Checking access" detail="Confirming your QIU account and permissions…" loading />;
  if (!user) {
    return <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="brand auth-brand" href="#" aria-label="VacancyPortal"><span className="brand-mark">VP</span><span>Vacancy<span>Portal</span></span><small>POC</small></a>
        <div className="auth-copy"><span className="detail-label">QIU PRIVATE ACCESS</span><h1 id="auth-title">Sign in to browse vacancies</h1><p>Use your verified QIU Google account. Other email domains cannot view vacancy or company information.</p></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="google-sign-in" type="button" onClick={signIn} disabled={!isFirebaseConfigured}><GoogleMark />Continue with QIU Google account</button>
        <small className="auth-boundary">Allowed domain: @qiu.edu.my</small>
      </section>
    </main>;
  }
  return <>{children}</>;
}

function AuthStatus({ title, detail, loading = false }: { title: string; detail: string; loading?: boolean }) {
  return <main className="auth-screen"><section className="auth-card auth-status" role="status" aria-live="polite">
    <span className="brand-mark">VP</span>{loading && <span className="auth-progress" aria-hidden="true" />}
    <h1>{title}</h1><p>{detail}</p>
  </section></main>;
}

export function AuthAccount() {
  const { user, role, signOut } = useAuth();
  if (!user || !role) return null;
  return <div className="auth-account">
    <span className="auth-avatar" aria-hidden="true">{(user.displayName || user.email || "Q").charAt(0).toUpperCase()}</span>
    <span><strong>{user.displayName || user.email}</strong><small>{role === "superadmin" ? "Super admin" : role}</small></span>
    <button type="button" onClick={signOut}>Sign out</button>
  </div>;
}

export function RoleManager() {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (role !== "superadmin" || !db) return;
    getDocs(collection(db, "users"))
      .then((snapshot) => setUsers(snapshot.docs.map((entry) => ({
        uid: entry.id,
        email: entry.data().email ?? "",
        displayName: entry.data().displayName ?? "",
        photoURL: entry.data().photoURL ?? "",
        role: roleForEmail(entry.data().email, entry.data().role),
      })).sort((a, b) => a.email.localeCompare(b.email))))
      .catch(() => setMessage("Could not load user roles."))
      .finally(() => setLoading(false));
  }, [role]);

  if (role !== "superadmin") return null;

  async function assignRole(record: UserRecord, nextRole: "user" | "admin") {
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

  return <section className="role-manager" aria-labelledby="role-manager-title">
    <div className="role-manager-head"><div><span className="detail-label">ACCESS CONTROL</span><h3 id="role-manager-title">QIU user roles</h3></div><small>{users.length} accounts</small></div>
    <p>Users can browse. Admins can add, edit, and remove vacancies. Superadmin identity is fixed.</p>
    {loading ? <p className="role-manager-state" role="status">Loading accounts…</p> : <div className="role-list">{users.map((record) => {
      const fixed = normalizeEmail(record.email) === SUPERADMIN_EMAIL;
      return <div className="role-row" key={record.uid}><span className="auth-avatar" aria-hidden="true">{(record.displayName || record.email || "Q").charAt(0).toUpperCase()}</span><span><strong>{record.displayName || record.email}</strong>{record.displayName && <small>{record.email}</small>}</span>{fixed ? <span className="fixed-role">Super admin</span> : <label><span className="sr-only">Role for {record.email}</span><select value={record.role} onChange={(event) => assignRole(record, event.target.value as "user" | "admin")}><option value="user">User</option><option value="admin">Admin</option></select></label>}</div>;
    })}</div>}
    {message && <p className="role-manager-message" role="status" aria-live="polite">{message}</p>}
  </section>;
}

function GoogleMark() {
  return <svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.59-5.04-3.72H.95v2.33A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.96 10.7a5.4 5.4 0 0 1 0-3.4V4.97H.95a9 9 0 0 0 0 8.06l3.01-2.33Z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15.02 2.35A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .95 4.97L3.96 7.3C4.67 5.17 6.66 3.58 9 3.58Z"/></svg>;
}

export type { UserRole } from "./auth-policy";
