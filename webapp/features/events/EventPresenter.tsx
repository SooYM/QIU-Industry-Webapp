import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { EventItem } from "../../lib/data/types";
import { ccaThresholdMinutes, setEventCode, stopEventCode } from "../../lib/data/firestore";
import { Modal } from "../../components/Modal";

function randomCode() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Projector view: shows a live QR that rotates on a schedule and publishes the code to Firestore. */
export function EventPresenter({ event, rotateSeconds, ccaSettings, onClose }: {
  event: EventItem;
  rotateSeconds: number;
  ccaSettings?: { ccaPercent: number };
  onClose: () => void;
}) {
  const isStatic = rotateSeconds === 0;
  const refreshMs = isStatic ? 0 : Math.max(5, rotateSeconds) * 1000;
  const [step, setStep] = useState<"checkin" | "checkout">("checkin");
  const [qr, setQr] = useState("");
  const [count, setCount] = useState(isStatic ? 0 : refreshMs / 1000);

  useEffect(() => {
    let active = true;
    let currentCode = "";
    async function rotate() {
      const code = randomCode();
      const now = Date.now();
      const previousCode = isStatic ? "" : currentCode;
      // Active code spans its visible interval plus the next interval. Once rotated,
      // the same deadline is published explicitly as previousCodeExpiry.
      const codeExpiry = isStatic ? 8.64e15 : now + refreshMs * 2;
      try {
        await setEventCode(event.id, {
          activeStep: step,
          activeCode: code,
          codeExpiry,
          previousCode,
          previousCodeExpiry: previousCode ? now + refreshMs : 0,
        });
        currentCode = code;
        const url = `${window.location.origin}/?ev=${event.id}&s=${step}&c=${code}`;
        const dataUrl = await QRCode.toDataURL(url, { width: 460, margin: 1 });
        if (active) { setQr(dataUrl); setCount(isStatic ? 0 : refreshMs / 1000); }
      } catch { /* transient; next tick retries */ }
    }
    rotate();
    const rotationTimer = isStatic ? undefined : window.setInterval(rotate, refreshMs);
    const countdownTimer = isStatic ? undefined : window.setInterval(() => setCount((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => { active = false; if (rotationTimer) clearInterval(rotationTimer); if (countdownTimer) clearInterval(countdownTimer); };
  }, [event.id, step, refreshMs, isStatic]);

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
      <p className="presenter-hint">Students scan to <b>{step === "checkin" ? "CHECK IN" : "CHECK OUT"}</b>. {isStatic ? "Static QR — it will not rotate." : <>Refreshes in {count}s. Previous QR remains valid for {rotateSeconds}s after rotation.</>}</p>
      <p className="text-accent text-xs">{event.sessionMinutes > 0 ? <>Keep this on the projector. CCA credit requires ≥ {ccaThresholdMinutes(event.sessionMinutes, ccaSettings)} min between check-in and check-out.</> : "Set a valid event duration before CCA eligibility can be awarded."}</p>
    </Modal>
  );
}
