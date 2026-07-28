"use client";

import { useState, useEffect } from "react";
import { StudentProfile } from "./student-data";

interface CvGeneratorModalProps {
  student: StudentProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStudent?: (updated: StudentProfile) => void;
}

export function CvGeneratorModal({ student, isOpen, onClose, onUpdateStudent }: CvGeneratorModalProps) {
  const [format, setFormat] = useState<"ats" | "professional">("ats");
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editProfile, setEditProfile] = useState<StudentProfile>(student);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const generatePlainTextCv = (p: StudentProfile) => {
    const lines: string[] = [];
    lines.push(p.fullName.toUpperCase());
    lines.push(`${p.email} | ${p.phone}${p.linkedin ? ` | ${p.linkedin}` : ""}${p.github ? ` | ${p.github}` : ""}`);
    lines.push("");
    
    if (p.summary) {
      lines.push("PROFESSIONAL SUMMARY");
      lines.push("--------------------");
      lines.push(p.summary);
      lines.push("");
    }

    lines.push("EDUCATION");
    lines.push("---------");
    lines.push(`${p.university} — ${p.faculty}`);
    lines.push(`${p.major} | CGPA: ${p.cgpa.toFixed(2)} / 4.00 (Expected Grad: ${p.expectedGraduation})`);
    lines.push(`Student ID: ${p.studentId}`);
    lines.push("");

    if (p.courses && p.courses.length > 0) {
      lines.push("KEY ACADEMIC COURSEWORK & RESULTS");
      lines.push("----------------------------------");
      const courseList = p.courses.map((c) => `${c.code} ${c.name} (Grade: ${c.grade})`).join(" | ");
      lines.push(courseList);
      lines.push("");
    }

    if (p.fyp) {
      lines.push("FINAL YEAR PROJECT (FYP)");
      lines.push("------------------------");
      lines.push(`Title: ${p.fyp.title}`);
      lines.push(`Supervisor: ${p.fyp.supervisor} | Grade: ${p.fyp.grade}`);
      lines.push(`Technologies: ${p.fyp.technologies.join(", ")}`);
      lines.push(`Abstract: ${p.fyp.abstract}`);
      lines.push("");
    }

    if (p.extracurriculars && p.extracurriculars.length > 0) {
      lines.push("LEADERSHIP & EXTRACURRICULAR POSITIONS");
      lines.push("--------------------------------------");
      for (const ex of p.extracurriculars) {
        lines.push(`${ex.role} — ${ex.organization} (${ex.period})`);
        lines.push(`• ${ex.description}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  };

  const handleCopyText = async () => {
    const plainText = generatePlainTextCv(isEditing ? editProfile : student);
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const saveEdits = () => {
    if (onUpdateStudent) {
      onUpdateStudent(editProfile);
    }
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overscroll-contain touch-pan-y print:p-0 print:bg-white" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:text-slate-100 overscroll-contain print:h-auto print:max-w-none print:shadow-none print:bg-white print:text-black">
        {/* Top-Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-3.5 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100/80 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white print:hidden"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-4 pr-16 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              📄
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">1-Click Student CV Generator</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generated from university academic results, coursework, FYP & leadership records.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Format Switcher */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setFormat("ats")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  format === "ats"
                    ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-600 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                📋 ATS Format
              </button>
              <button
                type="button"
                onClick={() => setFormat("professional")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  format === "professional"
                    ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-600 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                ✨ Professional Format
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="rounded-xl border border-slate-300 bg-slate-100 text-slate-800 px-3.5 py-1.5 text-xs font-bold shadow-sm hover:bg-slate-200 active:scale-95 transition dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              {isEditing ? "Cancel Editing" : "✏️ Edit Details"}
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="rounded-xl border border-slate-300 bg-slate-100 text-slate-800 px-3.5 py-1.5 text-xs font-bold shadow-sm hover:bg-slate-200 active:scale-95 transition dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              {copied ? "✓ Copied Plain Text!" : "📋 Copy ATS Text"}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-1.5 text-xs font-bold shadow-md hover:bg-indigo-700 active:scale-95 transition-all dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              🖨️ Print / Save PDF
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 print:overflow-visible print:p-0">
          {isEditing ? (
            <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-300">Edit Student Record Fields</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Full Name</label>
                  <input
                    type="text"
                    value={editProfile.fullName}
                    onChange={(e) => setEditProfile({ ...editProfile, fullName: e.target.value })}
                    className="w-full rounded-lg border p-2 text-xs text-black dark:text-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Email</label>
                  <input
                    type="text"
                    value={editProfile.email}
                    onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })}
                    className="w-full rounded-lg border p-2 text-xs text-black dark:text-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">University</label>
                  <input
                    type="text"
                    value={editProfile.university}
                    onChange={(e) => setEditProfile({ ...editProfile, university: e.target.value })}
                    className="w-full rounded-lg border p-2 text-xs text-black dark:text-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Major</label>
                  <input
                    type="text"
                    value={editProfile.major}
                    onChange={(e) => setEditProfile({ ...editProfile, major: e.target.value })}
                    className="w-full rounded-lg border p-2 text-xs text-black dark:text-white dark:bg-slate-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Professional Summary</label>
                  <textarea
                    rows={2}
                    value={editProfile.summary}
                    onChange={(e) => setEditProfile({ ...editProfile, summary: e.target.value })}
                    className="w-full rounded-lg border p-2 text-xs text-black dark:text-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={saveEdits}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Save Changes to CV
              </button>
            </div>
          ) : format === "ats" ? (
            /* ATS FORMAT - Clean, standard typography, high readability, single column */
            <div className="mx-auto max-w-3xl font-serif text-slate-900 dark:text-slate-100 print:text-black print:max-w-none">
              <div className="border-b-2 border-slate-900 pb-3 text-center print:border-black">
                <h1 className="text-2xl font-bold uppercase tracking-wider">{student.fullName}</h1>
                <p className="mt-1 text-sm font-sans text-slate-700 dark:text-slate-300 print:text-black">
                  {student.email} | {student.phone}
                  {student.linkedin ? ` | ${student.linkedin}` : ""}
                  {student.github ? ` | ${student.github}` : ""}
                </p>
              </div>

              {student.summary && (
                <section className="mt-4">
                  <h2 className="border-b border-slate-400 font-sans text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 print:text-black">
                    Professional Summary
                  </h2>
                  <p className="mt-1 font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-200 print:text-black">
                    {student.summary}
                  </p>
                </section>
              )}

              <section className="mt-4">
                <h2 className="border-b border-slate-400 font-sans text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 print:text-black">
                  Education
                </h2>
                <div className="mt-1 flex justify-between font-sans text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 print:text-black">{student.university}</span> — {student.faculty}
                    <div className="italic text-slate-800 dark:text-slate-200 print:text-black">{student.major}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">CGPA: {student.cgpa.toFixed(2)} / 4.00</span>
                    <div className="text-slate-600 dark:text-slate-400 print:text-black">Graduation: {student.expectedGraduation}</div>
                  </div>
                </div>
              </section>

              {student.courses && student.courses.length > 0 && (
                <section className="mt-4">
                  <h2 className="border-b border-slate-400 font-sans text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 print:text-black">
                    Academic Coursework & Results
                  </h2>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs">
                    {student.courses.map((course) => (
                      <div key={course.code} className="flex justify-between border-b border-slate-100 py-0.5 dark:border-slate-800">
                        <span>{course.code} {course.name}</span>
                        <span className="font-bold">Grade: {course.grade}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Graceful Null Check for FYP */}
              {student.fyp && (
                <section className="mt-4">
                  <h2 className="border-b border-slate-400 font-sans text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 print:text-black">
                    Final Year Project (FYP)
                  </h2>
                  <div className="mt-1 font-sans text-xs">
                    <div className="flex justify-between font-bold">
                      <span>{student.fyp.title}</span>
                      <span>Grade: {student.fyp.grade}</span>
                    </div>
                    <p className="mt-0.5 text-slate-700 dark:text-slate-300 print:text-black">
                      <span className="font-semibold">Supervisor:</span> {student.fyp.supervisor}
                    </p>
                    {student.fyp.technologies && student.fyp.technologies.length > 0 && (
                      <p className="text-slate-700 dark:text-slate-300 print:text-black">
                        <span className="font-semibold">Technologies:</span> {student.fyp.technologies.join(", ")}
                      </p>
                    )}
                    <p className="mt-1 leading-relaxed text-slate-800 dark:text-slate-200 print:text-black">{student.fyp.abstract}</p>
                  </div>
                </section>
              )}

              {/* Graceful Null Check for Extracurriculars */}
              {student.extracurriculars && student.extracurriculars.length > 0 && (
                <section className="mt-4">
                  <h2 className="border-b border-slate-400 font-sans text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 print:text-black">
                    Leadership & Extracurricular Positions
                  </h2>
                  <div className="mt-2 space-y-2 font-sans text-xs">
                    {student.extracurriculars.map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between font-bold">
                          <span>{item.role} — {item.organization}</span>
                          <span>{item.period}</span>
                        </div>
                        <p className="mt-0.5 text-slate-800 dark:text-slate-200 print:text-black">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            /* PROFESSIONAL FORMAT - Stylish modern layout with visual hierarchy, badges, and accents */
            <div className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:shadow-none print:p-0">
              {/* Header Banner */}
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {student.fullName}
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    {student.major}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {student.university} • {student.faculty}
                  </p>
                </div>
                <div className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">📧 {student.email}</div>
                  <div className="flex items-center gap-2">📱 {student.phone}</div>
                  {student.linkedin && <div className="flex items-center gap-2">🔗 {student.linkedin}</div>}
                  {student.github && <div className="flex items-center gap-2">💻 {student.github}</div>}
                </div>
              </div>

              {/* CGPA & Academic Stats Highlight Bar */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-indigo-50/70 p-4 sm:grid-cols-3 dark:bg-indigo-950/40">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Cumulative GPA</div>
                  <div className="text-xl font-extrabold text-indigo-950 dark:text-white">{student.cgpa.toFixed(2)} <span className="text-xs font-normal text-indigo-700 dark:text-indigo-400">/ 4.00</span></div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Graduation</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{student.expectedGraduation}</div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Student ID</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{student.studentId}</div>
                </div>
              </div>

              {student.summary && (
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <span>💡</span> Executive Summary
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {student.summary}
                  </p>
                </div>
              )}

              {/* Academic Coursework with Grade Badges */}
              {student.courses && student.courses.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <span>📚</span> Academic Coursework & Verified Grades
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {student.courses.map((course) => (
                      <div
                        key={course.code}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{course.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{course.code} • {course.category}</div>
                        </div>
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                            course.grade.startsWith("A")
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : course.grade.startsWith("B")
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {course.grade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FYP Section - Graceful Null Handling */}
              {student.fyp && (
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      <span>🔬</span> Final Year Project (FYP)
                    </h3>
                    <span className="rounded-lg bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Grade: {student.fyp.grade}
                    </span>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{student.fyp.title}</h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Supervisor:</span> {student.fyp.supervisor}
                  </p>
                  {student.fyp.technologies && student.fyp.technologies.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {student.fyp.technologies.map((tech) => (
                        <span key={tech} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">{student.fyp.abstract}</p>
                </div>
              )}

              {/* Extracurricular Section - Graceful Null Handling */}
              {student.extracurriculars && student.extracurriculars.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <span>🏆</span> Leadership & Extracurricular Positions
                  </h3>
                  <div className="mt-3 space-y-3">
                    {student.extracurriculars.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-100 p-3.5 dark:border-slate-800">
                        <div className="flex justify-between text-xs font-bold text-slate-900 dark:text-white">
                          <span>{item.role} — {item.organization}</span>
                          <span className="text-slate-500">{item.period}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
