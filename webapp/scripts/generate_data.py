import csv
import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1] / "data" / "jobs.json"

def salary_number(value):
    match = re.search(r"[\d,]+", str(value or ""))
    return int(match.group(0).replace(",", "")) if match else 0

discussions = pd.read_excel(ROOT / "company_discussions.xlsx", sheet_name="Discussions")
profiles = {}
for _, row in discussions.iterrows():
    name = str(row.get("Organization Name", "")).strip()
    if not name:
        continue
    summary = str(row.get("Summary of Discussions", "") or "").strip()
    links = str(row.get("Source Links", "") or "").strip()
    profiles[name.casefold()] = {
        "summary": "" if summary.lower() == "nan" else summary,
        "sources": [] if links.lower() in ("", "nan") else [x.strip() for x in links.split(",") if x.strip()],
    }

jobs = []
with (ROOT / "vacancy.csv").open(encoding="utf-8-sig", newline="") as handle:
    for index, row in enumerate(csv.DictReader(handle), start=1):
        company = row["Organization Name"].strip()
        profile = profiles.get(company.casefold(), {})
        jobs.append({
            "id": index,
            "title": row["Title"].strip(),
            "company": company,
            "type": row["Type"].strip(),
            "specialization": row["Specializations"].strip(),
            "vacancies": int(row["No of Vacancy"] or 0),
            "location": row["Location"].strip(),
            "salaryLabel": row["Salary"].strip(),
            "salary": salary_number(row["Salary"]),
            "payFrequency": row["Pay Freq"].strip(),
            "minimumRequirement": row["Min Req"].strip(),
            "detailsLink": row["View Details Link"].strip(),
            "email": row["Enquiry Email"].strip(),
            "companySummary": profile.get("summary", ""),
            "companySources": profile.get("sources", []),
        })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(jobs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {len(jobs)} jobs to {OUT}")
