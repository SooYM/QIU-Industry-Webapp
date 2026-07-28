import React from "react";

interface RichTextProps {
  content: string;
  className?: string;
}

/**
 * RichText Component for rendering Markdown-formatted AI Assistant messages.
 * Supports bold, italic, code tags, bullet lists, badges, and headers safely.
 */
export const RichText: React.FC<RichTextProps> = ({ content, className = "" }) => {
  const blocks = content.split("\n\n");

  const formatInline = (text: string): React.ReactNode[] => {
    // Regex for bold **text**, italic *text*, code `text`, and badge ⚡ SLM-Lite
    const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|⚡\s\*?[^*]+\*?)/g);

    return tokens.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} className="font-bold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
        return <em key={idx} className="italic text-slate-600 dark:text-slate-300">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={idx} className="rounded bg-slate-200 dark:bg-slate-800 px-1 py-0.5 font-mono text-xs text-indigo-600 dark:text-indigo-400">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.includes("SLM-Lite")) {
        return (
          <span key={idx} className="inline-flex items-center gap-1 rounded bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 shadow-sm border border-indigo-200 dark:border-indigo-800">
            {part.replace(/\*/g, "")}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={`rich-text space-y-2 text-sm leading-relaxed ${className}`}>
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Header check
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={bIdx} className="font-bold text-base text-slate-900 dark:text-white mt-2 mb-1">
              {formatInline(trimmed.slice(4))}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={bIdx} className="font-bold text-lg text-slate-900 dark:text-white mt-3 mb-1">
              {formatInline(trimmed.slice(3))}
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={bIdx} className="font-bold text-xl text-slate-900 dark:text-white mt-3 mb-2">
              {formatInline(trimmed.slice(2))}
            </h1>
          );
        }

        // List check (lines starting with • or -)
        const lines = trimmed.split("\n");
        const isList = lines.every((line) => line.trim().startsWith("•") || line.trim().startsWith("-"));

        if (isList) {
          return (
            <ul key={bIdx} className="space-y-1.5 my-2">
              {lines.map((line, lIdx) => {
                const itemText = line.trim().replace(/^[•-]\s*/, "");
                return (
                  <li key={lIdx} className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                    <span className="text-indigo-500 font-bold select-none">•</span>
                    <span className="flex-1">{formatInline(itemText)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Regular paragraph with mixed linebreaks
        return (
          <p key={bIdx} className="text-slate-800 dark:text-slate-200">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {formatInline(line)}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};
