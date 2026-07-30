import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { EventItem } from "../../lib/data/types";
import { ccaThresholdMinutes, setEventCode, stopEventCode } from "../../lib/data/firestore";
import { Modal } from "../../components/Modal";

const REFRESH_MS = 30000; // rotate every 30s; a screenshot expires almost immediately

function randomCode() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Projector view: shows a live QR that rotates every 25s and publishes the code to Firestore. */
export function EventPresenter({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const [step, setStep] = useState<"checkin" | "checkout">("checkin");
  const [qr, setQr] = useState("");
  const [count, setCount] = useState(REFRESH_MS / 1000);

  useEffect(() => {
    let active = true;
    async function rotate() {
      const code = randomCode();
      const codeExpiry = Date.now() + REFRESH_MS + 6000; // small grace for scan latency
      try {
        await setEventCode(event.id, { activeStep: step, activeCode: code, codeExpiry });
        const url = `${window.location.origin}/?ev=${event.id}&s=${step}&c=${code}`;
        const dataUrl = await QRCode.toDataURL(url, { width: 460, margin: 1 });
        if (active) { setQr(dataUrl); setCount(REFRESH_MS / 1000); }
      } catch { /* transient; next tick retries */ }
    }
    rotate();
    const iv = setInterval(rotate, REFRESH_MS);
    const tick = setInterval(() => setCount((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => { active = false; clearInterval(iv); clearInterval(tick); };
  }, [event.id, step]);

  function close() { stopEventCode(event.id).catch(() => {}); onClose(); }

  return (
    <Modal className="admin-panel event-presenter" labelledBy="presenter-title" closeLabel="Stop presenting" onClose={close}>
      <span className="detail-label">LIVE ATTENDANCE</span>
      <h2 id="presenter-title">{event.title}</h2>
      <div className="presenter-steps">
        <button type="button" className={step === "checkin" ? "tone-accent" : "text-accent"} onClick={() => setStep("checkin")}>① Check-in</button>
        <button type="button" className={step === "checkout" ? "tone-accent" : "text-accent"} onClick={() => setStep("checkout")}>② Check-out</button>
      </div>
      <div className="presenter-qr">{qr ? <img src={qr} alt="Scan to record attendance" /> : <p>Generating QR…</p>}</div>
      <p className="presenter-hint">Students scan to <b>{step === "checkin" ? "CHECK IN" : "CHECK OUT"}</b>. Refreshes in {count}s — a shared screenshot won&apos;t work.</p>
      <p className="text-accent text-xs">Keep this on the projector. CCA credit requires ≥ {ccaThresholdMinutes(event.sessionMinutes)} min between check-in and check-out.</p>
    </Modal>
  );
}
