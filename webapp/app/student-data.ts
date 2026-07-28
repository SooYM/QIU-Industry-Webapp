export type Grade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D+" | "D" | "F";

export interface CourseGrade {
  code: string;
  name: string;
  grade: Grade;
  gpa: number;
  category: "core" | "elective" | "major";
  subjectArea:
    | "machine-learning"
    | "cybersecurity"
    | "web-dev"
    | "data-analytics"
    | "software-engineering"
    | "networking"
    | "accounting"
    | "finance"
    | "business"
    | "hospitality"
    | "marketing"
    | "engineering"
    | "food-tech"
    | "education"
    | "psychology"
    | "pharmacy"
    | "general";
}

export interface FinalYearProject {
  title: string;
  abstract: string;
  supervisor: string;
  technologies: string[];
  grade: Grade;
}

export interface ExtracurricularPosition {
  role: string;
  organization: string;
  period: string;
  description: string;
}

export interface StudentProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  university: string;
  faculty: string;
  major: string;
  studentId: string;
  cgpa: number;
  expectedGraduation: string;
  courses: CourseGrade[];
  fyp: FinalYearProject | null;
  extracurriculars: ExtracurricularPosition[];
  summary: string;
}

export const gradeGpaMap: Record<Grade, number> = {
  "A+": 4.0,
  "A": 4.0,
  "A-": 3.7,
  "B+": 3.3,
  "B": 3.0,
  "B-": 2.7,
  "C+": 2.3,
  "C": 2.0,
  "D+": 1.3,
  "D": 1.0,
  "F": 0.0,
};

export const sampleStudentProfiles: StudentProfile[] = [
  {
    id: "student-ml-star",
    fullName: "Alex Tan Wei Lun",
    email: "alex.tan@student.um.edu.my",
    phone: "+60 12-345 6789",
    linkedin: "linkedin.com/in/alextan-ai",
    github: "github.com/alextan-ml",
    university: "Universiti Malaya (UM)",
    faculty: "Computing",
    major: "Bachelor of Computer Science (Hons)",
    studentId: "WIF210045",
    cgpa: 3.84,
    expectedGraduation: "August 2026",
    summary: "Final-year Computer Science student specializing in Machine Learning, Computer Vision, and AI Systems with proven research experience.",
    courses: [
      { code: "WIX3001", name: "Machine Learning & Neural Networks", grade: "A+", gpa: 4.0, category: "major", subjectArea: "machine-learning" },
      { code: "WIX3002", name: "Data Mining & Knowledge Discovery", grade: "A", gpa: 4.0, category: "major", subjectArea: "data-analytics" },
      { code: "WIX3003", name: "Computer Vision & Pattern Recognition", grade: "A+", gpa: 4.0, category: "major", subjectArea: "machine-learning" },
      { code: "WIX2001", name: "Software Engineering Architecture", grade: "B+", gpa: 3.3, category: "core", subjectArea: "software-engineering" },
      { code: "WIX3005", name: "Cybersecurity & Information Assurance", grade: "D+", gpa: 1.3, category: "elective", subjectArea: "cybersecurity" },
    ],
    fyp: {
      title: "Deep Learning Based Automated Visual Defect Inspection for SMT Manufacturing",
      abstract: "Engineered a real-time YOLOv8 defect detection pipeline achieving 96.4% precision on industrial circuit board inspection.",
      supervisor: "Dr. Hiew Chee Seng",
      technologies: ["PyTorch", "Python", "OpenCV", "YOLOv8", "FastAPI"],
      grade: "A+",
    },
    extracurriculars: [
      {
        role: "Vice President & AI Lead",
        organization: "UM AI & Data Science Society",
        period: "2023 - 2025",
        description: "Organized 3 national AI hackathons and conducted PyTorch bootcamps for 250+ undergraduates.",
      },
    ],
  },
  {
    id: "student-accountancy",
    fullName: "Nurul Sarah Binti Razak",
    email: "sarah.razak@student.qiu.edu.my",
    phone: "+60 17-334 8899",
    linkedin: "linkedin.com/in/sarah-razak-accounting",
    github: "",
    university: "Quest International University (QIU)",
    faculty: "Accounting and Finance",
    major: "Bachelor of Accountancy (Honours)",
    studentId: "ACC210088",
    cgpa: 3.82,
    expectedGraduation: "June 2026",
    summary: "High-achieving Accounting student specializing in Audit & Financial Reporting, Tax Strategy, and Compliance, aiming for CPA qualification.",
    courses: [
      { code: "ACT301", name: "Advanced Financial Accounting & Reporting", grade: "A+", gpa: 4.0, category: "major", subjectArea: "accounting" },
      { code: "ACT304", name: "Auditing & Assurance Services", grade: "A", gpa: 4.0, category: "major", subjectArea: "accounting" },
      { code: "FIN202", name: "Corporate Finance & Capital Markets", grade: "A-", gpa: 3.7, category: "core", subjectArea: "finance" },
      { code: "TAX301", name: "Malaysian Taxation & Compliance", grade: "A", gpa: 4.0, category: "major", subjectArea: "accounting" },
      { code: "CS101", name: "Computer Systems & Hardware Architecture", grade: "D", gpa: 1.0, category: "elective", subjectArea: "networking" },
    ],
    fyp: {
      title: "Impact of MFRS 16 Leases on Balance Sheet Ratios of Public Listed Retailers in Malaysia",
      abstract: "Evaluated pre and post MFRS 16 leverage and liquidity ratios across 45 Bursa Malaysia retail companies.",
      supervisor: "Assoc. Prof. Dr. Tan Kok Beng",
      technologies: ["Excel VBA", "SPSS", "Financial Modeling"],
      grade: "A",
    },
    extracurriculars: [
      {
        role: "Treasurer",
        organization: "QIU Accounting & Finance Society",
        period: "2024 - 2025",
        description: "Managed annual budget of RM 45,000 and organized annual Audit & Tax Workshop with Big-4 partners.",
      },
    ],
  },
  {
    id: "student-acca",
    fullName: "Tee Jun Hao",
    email: "junhao.tee@student.qiu.edu.my",
    phone: "+60 16-554 1122",
    linkedin: "linkedin.com/in/tee-junhao-acca",
    github: "",
    university: "Quest International University (QIU)",
    faculty: "Professional Certificates",
    major: "ACCA Qualification",
    studentId: "ACCA22019",
    cgpa: 3.90,
    expectedGraduation: "December 2026",
    summary: "ACCA candidate focused on Strategic Business Reporting, Governance, and Forensic Accounting with hands-on internship experience.",
    courses: [
      { code: "SBR", name: "Strategic Business Reporting (SBR)", grade: "A+", gpa: 4.0, category: "major", subjectArea: "accounting" },
      { code: "AAA", name: "Advanced Audit & Assurance (AAA)", grade: "A+", gpa: 4.0, category: "major", subjectArea: "accounting" },
      { code: "AFM", name: "Advanced Financial Management (AFM)", grade: "A", gpa: 4.0, category: "major", subjectArea: "finance" },
      { code: "IT102", name: "Software Development", grade: "C", gpa: 2.0, category: "elective", subjectArea: "software-engineering" },
    ],
    fyp: {
      title: "Internal Audit Controls and Fraud Risk Mitigation in Digital Banking",
      abstract: "Developed an internal control assessment matrix for fraud prevention in e-wallet financial services.",
      supervisor: "Dr. Lim Cheng Hoe",
      technologies: ["ACL Analytics", "Excel", "Data Auditing"],
      grade: "A+",
    },
    extracurriculars: [
      {
        role: "Student Ambassador",
        organization: "ACCA Student Club Malaysia",
        period: "2023 - 2025",
        description: "Represented student body at ACCA regional leader summits and mentored 40 junior candidates.",
      },
    ],
  },
  {
    id: "student-business-bba",
    fullName: "Chong Ming Lee",
    email: "minglee.chong@student.qiu.edu.my",
    phone: "+60 19-445 2233",
    linkedin: "linkedin.com/in/chongminglee-bba",
    github: "",
    university: "Quest International University (QIU)",
    faculty: "Business",
    major: "Bachelor of Business Administration (Honours)",
    studentId: "BBA210042",
    cgpa: 3.75,
    expectedGraduation: "November 2026",
    summary: "Business Administration major with expertise in Digital Marketing, Market Analysis, and Operations Strategy.",
    courses: [
      { code: "MKT302", name: "Digital Marketing & E-Commerce Strategy", grade: "A+", gpa: 4.0, category: "major", subjectArea: "marketing" },
      { code: "MGT305", name: "Strategic Management & Business Policy", grade: "A", gpa: 4.0, category: "major", subjectArea: "business" },
      { code: "SCM201", name: "Supply Chain & Logistics Management", grade: "A-", gpa: 3.7, category: "core", subjectArea: "business" },
      { code: "CS105", name: "Kernel & Operating System Security", grade: "D", gpa: 1.0, category: "elective", subjectArea: "cybersecurity" },
    ],
    fyp: {
      title: "Omnichannel Marketing Strategy Adoption in SME Retail Brands in Malaysia",
      abstract: "Investigated conversion rate metrics across 30 SME retail fashion brands utilizing Instagram Commerce and Shopee.",
      supervisor: "Dr. K. Saroja",
      technologies: ["Google Analytics", "HubSpot", "SPSS"],
      grade: "A",
    },
    extracurriculars: [
      {
        role: "President",
        organization: "QIU Young Entrepreneurs Club",
        period: "2024 - 2025",
        description: "Organized campus startup pitching competition featuring RM 20,000 seed funding prizes.",
      },
    ],
  },
  {
    id: "student-hospitality",
    fullName: "Devi A/P Rajan",
    email: "devi.rajan@student.qiu.edu.my",
    phone: "+60 11-2345 9988",
    linkedin: "linkedin.com/in/devi-rajan-hospitality",
    github: "",
    university: "Quest International University (QIU)",
    faculty: "Hospitality",
    major: "Bachelor of Hospitality Management (Honours)",
    studentId: "BHM210014",
    cgpa: 3.79,
    expectedGraduation: "August 2026",
    summary: "Hospitality Management specialist focused on luxury hotel operations, guest service excellence, and event execution.",
    courses: [
      { code: "HTL301", name: "Hotel Front Office & Revenue Management", grade: "A+", gpa: 4.0, category: "major", subjectArea: "hospitality" },
      { code: "HTL304", name: "Service Quality & Guest Experience", grade: "A+", gpa: 4.0, category: "major", subjectArea: "hospitality" },
      { code: "EVT202", name: "Corporate Event & Convention Management", grade: "A", gpa: 4.0, category: "core", subjectArea: "hospitality" },
      { code: "IT202", name: "Database Engineering & SQL", grade: "F", gpa: 0.0, category: "elective", subjectArea: "software-engineering" },
    ],
    fyp: {
      title: "Post-Pandemic Guest Loyalty and Service Quality Metrics in Boutique Hotels",
      abstract: "Surveyed 200 luxury boutique hotel guests to evaluate impact of digital check-in tools on satisfaction.",
      supervisor: "Assoc. Prof. Chef Muthu Kumar",
      technologies: ["Opera PMS", "Qualtrics", "Excel"],
      grade: "A+",
    },
    extracurriculars: [
      {
        role: "Event Operations Director",
        organization: "QIU Hospitality & Culinary Guild",
        period: "2023 - 2025",
        description: "Coordinated annual University Gala Dinner catering for 600 VIP guests and delegates.",
      },
    ],
  },
  {
    id: "student-mass-comm",
    fullName: "Ahmad Amirul Bin Firdaus",
    email: "amirul.firdaus@student.qiu.edu.my",
    phone: "+60 13-987 1122",
    linkedin: "linkedin.com/in/amirul-advertising",
    github: "",
    university: "Quest International University (QIU)",
    faculty: "Communication",
    major: "Bachelor of Mass Communication (Honours) Advertising",
    studentId: "BMC220033",
    cgpa: 3.72,
    expectedGraduation: "July 2026",
    summary: "Creative Advertising major with skills in Digital Campaign Planning, Copywriting, Video Production, and Brand Positioning.",
    courses: [
      { code: "ADV301", name: "Digital Advertising & Campaign Strategy", grade: "A+", gpa: 4.0, category: "major", subjectArea: "marketing" },
      { code: "ADV302", name: "Creative Copywriting & Art Direction", grade: "A", gpa: 4.0, category: "major", subjectArea: "marketing" },
      { code: "PR201", name: "Corporate Reputation & Crisis Communications", grade: "A", gpa: 4.0, category: "core", subjectArea: "marketing" },
      { code: "NET101", name: "Network Infrastructure & Routers", grade: "D+", gpa: 1.3, category: "elective", subjectArea: "networking" },
    ],
    fyp: {
      title: "Evaluating Gen-Z Brand Engagement with TikTok Short-Form Video Advertisements",
      abstract: "Analyzed audience retention and click-through rates across 15 interactive mobile video ad formats.",
      supervisor: "Dr. Farah Hanim",
      technologies: ["Adobe Premiere", "Canva", "TikTok Analytics"],
      grade: "A",
    },
    extracurriculars: [
      {
        role: "Chief Creative Editor",
        organization: "QIU Campus Media & Creative Agency",
        period: "2024 - 2025",
        description: "Directed promotional videos for university enrollment campaigns reaching 100k+ views.",
      },
    ],
  },
  {
    id: "student-mechatronics",
    fullName: "Muhammad Hafiz Bin Ismail",
    email: "hafiz.ismail@student.qiu.edu.my",
    phone: "+60 14-887 6655",
    linkedin: "linkedin.com/in/hafiz-mechatronics",
    github: "github.com/hafiz-robotics",
    university: "Quest International University (QIU)",
    faculty: "Engineering",
    major: "Bachelor of Mechatronics Engineering With Honours",
    studentId: "ENG200109",
    cgpa: 3.81,
    expectedGraduation: "October 2026",
    summary: "Mechatronics Engineer skilled in Robotics, Industrial Automation, PLC Control Systems, and Microcontroller Hardware Integration.",
    courses: [
      { code: "MCT301", name: "Robotics Kinematics & Embedded Systems", grade: "A+", gpa: 4.0, category: "major", subjectArea: "engineering" },
      { code: "MCT304", name: "PLC Programming & Factory Automation", grade: "A+", gpa: 4.0, category: "major", subjectArea: "engineering" },
      { code: "MCT202", name: "Control Systems & Signal Processing", grade: "A", gpa: 4.0, category: "core", subjectArea: "engineering" },
      { code: "MKT101", name: "Consumer Behavior & Marketing", grade: "D", gpa: 1.0, category: "elective", subjectArea: "marketing" },
    ],
    fyp: {
      title: "Autonomous Inspection Rover with Edge LiDAR and SLAM for Factory Warehouses",
      abstract: "Constructed a 4-wheel ROS2 mobile robot featuring obstacle avoidance and real-time point cloud mapping.",
      supervisor: "Ir. Dr. Wong Kah Keng",
      technologies: ["ROS2", "C++", "Python", "LiDAR", "STM32", "Arduino"],
      grade: "A+",
    },
    extracurriculars: [
      {
        role: "Team Captain",
        organization: "QIU Robocon Competition Team",
        period: "2023 - 2025",
        description: "Led 12-member engineering team to national top 5 finish in Malaysia National Robocon 2024.",
      },
    ],
  },
  {
    id: "student-biotech",
    fullName: "Grace Wong Mei Ling",
    email: "grace.wong@student.qiu.edu.my",
    phone: "+60 12-776 3322",
    linkedin: "linkedin.com/in/gracewong-foodtech",
    github: "",
    university: "Quest International University (QIU)",
    faculty: "Integrated Life Sciences",
    major: "Bachelor in Food Science with Management (Honours)",
    studentId: "FSM210055",
    cgpa: 3.86,
    expectedGraduation: "September 2026",
    summary: "Food Science Specialist focusing on Food Safety & HACCP, Product Formulation, Packaging Technology, and Quality Assurance.",
    courses: [
      { code: "FST301", name: "Food Microbiology & Safety Assurance", grade: "A+", gpa: 4.0, category: "major", subjectArea: "food-tech" },
      { code: "FST303", name: "New Product Development & Processing", grade: "A", gpa: 4.0, category: "major", subjectArea: "food-tech" },
      { code: "FST202", name: "Sensory Evaluation & Quality Control", grade: "A", gpa: 4.0, category: "core", subjectArea: "food-tech" },
      { code: "CS201", name: "Cybersecurity & Firewall Policies", grade: "D+", gpa: 1.3, category: "elective", subjectArea: "cybersecurity" },
    ],
    fyp: {
      title: "Shelf-Life Stability and Antioxidant Activity of Plant-Based Functional Beverages",
      abstract: "Formulated a dragonfruit-based antioxidant drink and tested microbial stability over 90 days cold storage.",
      supervisor: "Dr. Nirmala Devi",
      technologies: ["HPLC", "Spectrophotometry", "HACCP Audit"],
      grade: "A+",
    },
    extracurriculars: [
      {
        role: "Head of Safety & Quality",
        organization: "QIU Food Science Student Society",
        period: "2024 - 2025",
        description: "Maintained lab safety protocols and led student delegation to National Food Technology Symposium.",
      },
    ],
  },
  {
    id: "student-education-tesl",
    fullName: "Hannah Elizabeth A/P Samuel",
    email: "hannah.samuel@student.qiu.edu.my",
    phone: "+60 16-332 7788",
    linkedin: "linkedin.com/in/hannah-samuel-tesl",
    github: "",
    university: "Quest International University (QIU)",
    faculty: "Education",
    major: "Bachelor of Arts (Honours) Teaching of English as a Second Language",
    studentId: "TESL210012",
    cgpa: 3.88,
    expectedGraduation: "July 2026",
    summary: "TESL educator specializing in Curriculum Design, Educational Technology, Pedagogy, and Interactive Classroom Management.",
    courses: [
      { code: "TSL301", name: "Second Language Acquisition & Methodology", grade: "A+", gpa: 4.0, category: "major", subjectArea: "education" },
      { code: "TSL304", name: "Educational Technology & E-Learning", grade: "A+", gpa: 4.0, category: "major", subjectArea: "education" },
      { code: "TSL202", name: "English Phonetics & Applied Linguistics", grade: "A", gpa: 4.0, category: "core", subjectArea: "education" },
      { code: "ACT101", name: "Financial Accounting Basics", grade: "C", gpa: 2.0, category: "elective", subjectArea: "accounting" },
    ],
    fyp: {
      title: "Integrating Interactive Gamification Apps in Secondary School ESL Writing Classes",
      abstract: "Evaluated writing score improvements across 80 secondary students using gamified digital feedback tools.",
      supervisor: "Dr. Robert Lingam",
      technologies: ["Kahoot", "Padlet", "Canva", "Google Classroom"],
      grade: "A+",
    },
    extracurriculars: [
      {
        role: "President",
        organization: "QIU TESL Educators Guild",
        period: "2024 - 2025",
        description: "Organized English language volunteer tutoring camps for rural primary school students.",
      },
    ],
  },
  {
    id: "student-psychology",
    fullName: "Marcus Tan Chee Beng",
    email: "marcus.tan@student.qiu.edu.my",
    phone: "+60 17-998 4433",
    linkedin: "linkedin.com/in/marcustan-psychology",
    github: "",
    university: "Quest International University (QIU)",
    faculty: "Psychology",
    major: "Bachelor of Psychology (Honours)",
    studentId: "PSY210067",
    cgpa: 3.77,
    expectedGraduation: "December 2026",
    summary: "Psychology major focused on Organizational Behavior, Talent Assessment, Cognitive Metrics, and Mental Health Initiatives.",
    courses: [
      { code: "PSY301", name: "Organizational & Industrial Psychology", grade: "A+", gpa: 4.0, category: "major", subjectArea: "psychology" },
      { code: "PSY303", name: "Psychological Testing & Psychometrics", grade: "A", gpa: 4.0, category: "major", subjectArea: "psychology" },
      { code: "PSY202", name: "Cognitive Psychology & Memory", grade: "A", gpa: 4.0, category: "core", subjectArea: "psychology" },
      { code: "HW101", name: "Electronics & Circuit Wiring", grade: "F", gpa: 0.0, category: "elective", subjectArea: "engineering" },
    ],
    fyp: {
      title: "Assessing Workplace Burnout and Psychological Resilience in Hybrid Work Environments",
      abstract: "Surveyed 150 corporate knowledge workers to identify key organizational buffers against emotional exhaustion.",
      supervisor: "Dr. Michelle Lee",
      technologies: ["SPSS", "R", "SurveyMonkey"],
      grade: "A",
    },
    extracurriculars: [
      {
        role: "Lead Student Counselor",
        organization: "QIU Peer Support & Mental Health Network",
        period: "2023 - 2025",
        description: "Managed confidential peer counseling desk and led university Mental Health Awareness Week.",
      },
    ],
  },
  {
    id: "student-pharmacy",
    fullName: "Priyanka A/P Subramaniam",
    email: "priyanka.subra@student.qiu.edu.my",
    phone: "+60 18-223 5566",
    linkedin: "linkedin.com/in/priyanka-pharmacy",
    github: "",
    university: "Quest International University (QIU)",
    faculty: "Pharmacy",
    major: "Bachelor of Pharmacy with Honours",
    studentId: "PHM200018",
    cgpa: 3.85,
    expectedGraduation: "October 2026",
    summary: "Pharmacy Honours student trained in Clinical Therapeutics, Pharmacology, Compounding, and Patient Care Management.",
    courses: [
      { code: "PHR301", name: "Pharmacology & Clinical Therapeutics", grade: "A+", gpa: 4.0, category: "major", subjectArea: "pharmacy" },
      { code: "PHR304", name: "Hospital & Clinical Pharmacy Practice", grade: "A", gpa: 4.0, category: "major", subjectArea: "pharmacy" },
      { code: "PHR202", name: "Medicinal Chemistry & Pharmacokinetics", grade: "A", gpa: 4.0, category: "core", subjectArea: "pharmacy" },
      { code: "ART101", name: "3D Animation & Graphic Design", grade: "D", gpa: 1.0, category: "elective", subjectArea: "marketing" },
    ],
    fyp: {
      title: "Evaluation of Medication Adherence Interventions in Elderly Type-2 Diabetes Patients",
      abstract: "Monitored compliance rates across 100 outpatient clinic attendees receiving tailored pill organizer counseling.",
      supervisor: "Prof. Dr. V. Jayanthi",
      technologies: ["Clinical Auditing", "SPSS", "Pharmacovigilance"],
      grade: "A+",
    },
    extracurriculars: [
      {
        role: "Vice President",
        organization: "QIU Pharmacy Students Association (QPSA)",
        period: "2024 - 2025",
        description: "Organized community health screening outreach servicing 800+ local Ipoh residents.",
      },
    ],
  },
  {
    id: "student-failed-cs",
    fullName: "Jason Kumar A/L Suresh",
    email: "jason.kumar@student.qiu.edu.my",
    phone: "+60 11-9988 7766",
    linkedin: "linkedin.com/in/jasonkumar-cs",
    github: "github.com/jasonk-dev",
    university: "Quest International University (QIU)",
    faculty: "Computing",
    major: "Bachelor of Computer Science (Hons)",
    studentId: "CS210099",
    cgpa: 1.95,
    expectedGraduation: "December 2027 (Extended)",
    summary: "Undergraduate student currently under academic advisory retaking core software modules; seeking entry-level support or internship opportunities.",
    courses: [
      { code: "WIX2001", name: "Software Engineering Architecture", grade: "F", gpa: 0.0, category: "core", subjectArea: "software-engineering" },
      { code: "WIX2002", name: "Database Systems & SQL", grade: "F", gpa: 0.0, category: "core", subjectArea: "data-analytics" },
      { code: "WIX3001", name: "Machine Learning Fundamentals", grade: "D", gpa: 1.0, category: "major", subjectArea: "machine-learning" },
      { code: "WEB101", name: "Web Development Basics", grade: "C", gpa: 2.0, category: "core", subjectArea: "web-dev" },
      { code: "ENG101", name: "Technical Communication", grade: "B", gpa: 3.0, category: "elective", subjectArea: "general" },
    ],
    fyp: null,
    extracurriculars: [],
  },
  {
    id: "student-failed-accounting",
    fullName: "Siti Aishah Binti Zulkifli",
    email: "aishah.zulkifli@student.qiu.edu.my",
    phone: "+60 19-3344 5566",
    linkedin: "",
    github: "",
    university: "Quest International University (QIU)",
    faculty: "Accounting and Finance",
    major: "Bachelor of Accountancy (Honours)",
    studentId: "ACC210099",
    cgpa: 2.12,
    expectedGraduation: "August 2027 (Extended)",
    summary: "Accounting undergraduate currently retaking advanced audit and financial reporting courses.",
    courses: [
      { code: "ACT301", name: "Advanced Financial Accounting & Reporting", grade: "F", gpa: 0.0, category: "major", subjectArea: "accounting" },
      { code: "ACT304", name: "Auditing & Assurance Services", grade: "D+", gpa: 1.3, category: "major", subjectArea: "accounting" },
      { code: "LAW201", name: "Business Law", grade: "C", gpa: 2.0, category: "core", subjectArea: "business" },
      { code: "ENG102", name: "Business Communication", grade: "B+", gpa: 3.3, category: "elective", subjectArea: "general" },
    ],
    fyp: null,
    extracurriculars: [],
  },
];
