// The single runtime-configurable settings document, edited by approvers.
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { clean, COLLECTIONS, DEFAULT_SETTINGS, requireDb } from "./client";
import type { AppSettings } from "./types";

// ---- App settings ----------------------------------------------------------

const SETTINGS_DOC = "app";

export function subscribeSettings(onData: (settings: AppSettings) => void) {
  return onSnapshot(doc(requireDb(), COLLECTIONS.settings, SETTINGS_DOC), (snap) => {
    const stored = snap.exists() ? (snap.data() as Partial<AppSettings>) : {};
    onData({
      ...DEFAULT_SETTINGS,
      ...stored,
      tabs: { ...DEFAULT_SETTINGS.tabs, ...(stored.tabs ?? {}) },
    });
  });
}

export async function saveSettings(settings: AppSettings) {
  await setDoc(doc(requireDb(), COLLECTIONS.settings, SETTINGS_DOC),
    { ...clean(settings), updatedAt: serverTimestamp() }, { merge: true });
}
