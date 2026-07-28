"use client";

import { useState, useEffect } from "react";
import { StudentProfile, sampleStudentProfiles } from "./student-data";

interface StudentModalProps {
  currentStudent: StudentProfile;
  isOpen: boolean;
  onClose: () => void;
  onSelectStudent: (student: StudentProfile) => void;
  onOpenCvGenerator: () => void;
}

export function StudentModal({
  currentStudent,
  isOpen,
  onClose,
  onSelectStudent,
  onOpenCvGenerator,
}: StudentModalProps) {
  const [activeTab, setActiveTab] = useState<"transcript" | "fyp" | "leadership" | "profiles">("transcript");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overscroll-contain touch-pan-y" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:text-slate-100 overscroll-contain">
        {/* Top-Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100/80 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-5 pr-16 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-xl text-white shadow-sm">
              🎓
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{currentStudent.fullName}</h2>
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  CGPA {currentStudent.cgpa.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {currentStudent.university} • {currentStudent.major} ({currentStudent.studentId})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCvGenerator();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition-all dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              📄 1-Click Generate CV
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-5 dark:border-slate-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("transcript")}
            className={`border-b-2 py-3 px-4 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "transcript"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            📚 Academic Transcript & Grades
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("fyp")}
            className={`border-b-2 py-3 px-4 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "fyp"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            🔬 Final Year Project (FYP)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leadership")}
            className={`border-b-2 py-3 px-4 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "leadership"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            🏆 Club Positions & Leadership
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profiles")}
            className={`border-b-2 py-3 px-4 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "profiles"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            🔄 Switch Demo Student Profile
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          {activeTab === "transcript" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50">
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">💡 How Academic Grades Affect Job Recommendations</h4>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                  High grades (e.g. <strong>A+ in Machine Learning</strong>) will heavily boost jobs specifically matching Machine Learning. Low grades (e.g. <strong>D+ in Cybersecurity</strong>) will automatically exclude cybersecurity jobs from recommendations.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="p-3">Course Code</th>
                      <th className="p-3">Subject Name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-center">Grade</th>
                      <th className="p-3 text-right">Recommendation Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {currentStudent.courses.map((course) => (
                      <tr key={course.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{course.code}</td>
                        <td className="p-3 font-medium text-slate-900 dark:text-white">{course.name}</td>
                        <td className="p-3 capitalize text-slate-500">{course.category}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 font-bold ${
                              course.grade.startsWith("A")
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : course.grade.startsWith("B")
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {course.grade}
                          </span>
                        </td>
                        <td className="p-3 text-right text-xs">
                          {course.grade.startsWith("A") ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">🌟 High Job Recommendation Boost</span>
                          ) : ["C+", "C", "D+", "D", "F"].includes(course.grade) ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">⚠️ Excludes Related Vacancies</span>
                          ) : (
                            <span className="text-slate-500">Standard Consideration</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "fyp" && (
            <div className="space-y-4">
              {currentStudent.fyp ? (
                <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-indigo-100 px-3 py-1 text-xs font-extrabold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      Grade: {currentStudent.fyp.grade}
                    </span>
                    <span className="text-xs text-slate-500">Supervisor: {currentStudent.fyp.supervisor}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">{currentStudent.fyp.title}</h3>
                  <div className="mt-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Technologies Used</h4>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {currentStudent.fyp.technologies.map((tech) => (
                        <span key={tech} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Project Abstract</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">{currentStudent.fyp.abstract}</p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">No Final Year Project record found for this student.</div>
              )}
            </div>
          )}

          {activeTab === "leadership" && (
            <div className="space-y-3">
              {currentStudent.extracurriculars && currentStudent.extracurriculars.length > 0 ? (
                currentStudent.extracurriculars.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                      <span>{item.role} — {item.organization}</span>
                      <span className="text-xs text-slate-500 font-normal">{item.period}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{item.description}</p>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500">No extracurricular records found.</div>
              )}
            </div>
          )}

          {activeTab === "profiles" && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Select a Student Profile to Test Recommendation Logic</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {sampleStudentProfiles.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectStudent(p)}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      currentStudent.id === p.id
                        ? "border-indigo-600 bg-indigo-50/50 shadow-md dark:border-indigo-500 dark:bg-indigo-950/40"
                        : "border-slate-200 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{p.fullName}</h4>
                      {currentStudent.id === p.id && (
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">Active</span>
                      )}
                    </div>
                    <p className="text-xs text-indigo-600 font-medium dark:text-indigo-400 mt-0.5">{p.major}</p>
                    <div className="mt-3 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                      <div>🎯 CGPA: <strong className="text-slate-900 dark:text-white">{p.cgpa.toFixed(2)}</strong></div>
                      <div>
                        ⭐ Top Grade:{" "}
                        <strong className="text-emerald-600">
                          {p.courses.find((c) => c.grade === "A+")?.name ?? p.courses[0].name}
                        </strong>
                      </div>
                      <div>
                        ⚠️ Low Grade:{" "}
                        <strong className="text-red-500">
                          {p.courses.find((c) => ["D+", "D", "F", "C"].includes(c.grade))?.name ?? "None"}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
