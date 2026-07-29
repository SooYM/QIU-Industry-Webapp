import { FormEvent, useEffect, useRef, useState } from "react";
import type { Job } from "../../lib/data/types";
import { answerFromJobs } from "../../app/chat";
import { RichText } from "../../app/RichText";
import type { ChatMessage } from "../vacancies/vacancy-utils";

export function ChatAssistant({
  open,
  jobs,
  onClose,
  onSelectSource,
}: {
  open: boolean;
  jobs: Job[];
  onClose: () => void;
  onSelectSource: (job: Job) => void;
}) {
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me to compare jobs, find internships, or explain a listed company profile. I only use the supplied vacancy records." },
  ]);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !chatMessagesRef.current) return;
    chatMessagesRef.current.scrollTo({
      top: chatMessagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open]);

  function askAssistant(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const question = (suggested ?? chatInput).trim();
    if (!question) return;
    setChatInput("");
    setMessages((current) => [...current, { role: "user", content: question }]);
    const result = answerFromJobs(question, jobs);
    setMessages((current) => [...current, { role: "assistant", content: result.answer, sources: result.sources as Job[] }]);
  }

  if (!open) return null;

  return (
    <div className="chat-shell" role="dialog" aria-label="Grounded job assistant">
      <div className="chat-head"><div><span className="chat-icon" aria-hidden="true">✦</span><div><strong>Job Assistant <span className="ml-1 rounded px-1.5 py-0.5 text-[9px] font-extrabold tone-neutral">⚡ SLM-Lite v1.0</span></strong><small><i></i> On-Device Small Language Model RAG</small></div></div><button onClick={onClose} aria-label="Close assistant">×</button></div>
      <div className="chat-messages" ref={chatMessagesRef} aria-live="polite">{messages.map((message, index) => <div key={index} className={`message ${message.role}`}><RichText content={message.content} />{message.sources && message.sources.length > 0 && <div className="sources"><span>Sources</span>{message.sources.slice(0, 3).map(source => <button key={source.id} onClick={() => onSelectSource(source)}>{source.title} · {source.company}</button>)}</div>}</div>)}</div>
      <form className="chat-form" onSubmit={askAssistant}><input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about jobs, salaries, internships…" aria-label="Your question"/><button disabled={!chatInput.trim()} aria-label="Send question">↑</button></form>
      <div className="chat-boundary">Powered by SLM-Lite v1.0 (On-Device RAG Transformer)</div>
    </div>
  );
}
