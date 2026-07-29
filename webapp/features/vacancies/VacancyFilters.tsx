type RecommendationMode = "all" | "recommended";

export function VacancyFilters({
  isStudent,
  programmeLabel,
  recommendationMode,
  onRecommendationMode,
  query,
  onQuery,
  company,
  companies,
  onCompany,
  specialization,
  specializations,
  onSpecialization,
  type,
  types,
  onType,
  maxSalary,
  onMaxSalary,
  mobileFiltersOpen,
  onReset,
}: {
  isStudent: boolean;
  programmeLabel?: string;
  recommendationMode: RecommendationMode;
  onRecommendationMode: (mode: RecommendationMode) => void;
  query: string;
  onQuery: (value: string) => void;
  company: string;
  companies: string[];
  onCompany: (value: string) => void;
  specialization: string;
  specializations: string[];
  onSpecialization: (value: string) => void;
  type: string;
  types: string[];
  onType: (value: string) => void;
  maxSalary: number;
  onMaxSalary: (value: number) => void;
  mobileFiltersOpen: boolean;
  onReset: () => void;
}) {
  return (
    <aside className={`filters ${mobileFiltersOpen ? "open" : ""}`} id="vacancy-filters">
      <div className="section-heading"><div><span>FILTERS</span><h2>Refine results</h2></div><button onClick={onReset}>Reset</button></div>

      {isStudent && (
        <>
          <div className="mt-4 rounded-xl p-3.5 panel-accent transition-colors">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent">🎓 Your course</span>
            {programmeLabel
              ? <div className="mt-1 text-xs font-bold text-success">{programmeLabel}</div>
              : <div className="mt-1 text-[11px] font-medium text-accent">Course not detected from your directory profile — showing all vacancies.</div>}
          </div>

          <label className="field">
            <span>Course recommendation</span>
            <select value={recommendationMode} onChange={(e) => onRecommendationMode(e.target.value as RecommendationMode)}>
              <option value="all">All vacancies (matches first)</option>
              <option value="recommended">🌟 Recommended for my course only</option>
            </select>
          </label>
        </>
      )}

      <label className="field"><span>Search</span><div className="search-wrap"><input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Role, company or location" /></div></label>
      <label className="field"><span>Company</span><select value={company} onChange={(e) => onCompany(e.target.value)}>{companies.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="field"><span>Specialization</span><select value={specialization} onChange={(e) => onSpecialization(e.target.value)}>{specializations.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="field"><span>Opportunity type</span><select value={type} onChange={(e) => onType(e.target.value)}>{types.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="field salary-field"><span>Maximum monthly salary <b>RM {maxSalary.toLocaleString()}</b></span><input type="range" min="500" max="10000" step="100" value={maxSalary} onChange={(e) => onMaxSalary(Number(e.target.value))} /><div><small>RM 500</small><small>RM 10,000+</small></div></label>
      <div className="data-note"><span>i</span><p><strong>Market salary context</strong><br/>Details use 2024 DOSM occupation or sector means. They are benchmarks, not employer offers.</p></div>
    </aside>
  );
}
