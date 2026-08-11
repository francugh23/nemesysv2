export const DEPED_SSHS_CATALOG_URL = "https://www.deped.gov.ph/strengthened-shs-program/";
export const DEPED_SSHS_DO017_URL = "https://www.deped.gov.ph/wp-content/uploads/DO-017-s.-2026-%E2%80%93-Strengthened-Senior-High-School-Curriculum.pdf";
export const DEPED_SSHS_G12_PILOT_URL = "https://www.deped.gov.ph/wp-content/uploads/DM_s2026_036r-UPDATED.pdf";

type Classification = "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE";
type Track = "ACADEMIC" | "TECHPRO";

export type DepedShsCatalogCluster = {
  code: string;
  name: string;
  track: Track;
  sourceReference: string;
};

export type DepedShsCatalogEntry = {
  code: string;
  description: string;
  gradeLevel: "11" | "12";
  classification: Classification;
  clusterCode?: string;
  sourceReference: string;
  termApplicability: "UNSPECIFIED" | "ALL_CONFIGURED_TERMS";
  createOffering: boolean;
};

const catalogSource = `DepEd SSHS curriculum guides: ${DEPED_SSHS_CATALOG_URL}`;
const g12PilotSource = `DepEd DM 036, s. 2026 Grade 12 SSHS pilot: ${DEPED_SSHS_G12_PILOT_URL}; ${DEPED_SSHS_CATALOG_URL}`;

export const depedShsCatalogClusters: DepedShsCatalogCluster[] = [
  { code: "DEPED-ACA-ASSH", name: "Arts, Social Science, and Humanities", track: "ACADEMIC", sourceReference: catalogSource },
  { code: "DEPED-ACA-BE", name: "Business and Entrepreneurship", track: "ACADEMIC", sourceReference: catalogSource },
  { code: "DEPED-ACA-STEM", name: "Science, Technology, Engineering, and Mathematics", track: "ACADEMIC", sourceReference: catalogSource },
  { code: "DEPED-ACA-SHW", name: "Sports, Health, and Wellness", track: "ACADEMIC", sourceReference: catalogSource },
  { code: "DEPED-ACA-FE", name: "Field Experience", track: "ACADEMIC", sourceReference: catalogSource },
  { code: "DEPED-TP-AWHC", name: "Aesthetic, Wellness, and Human Care", track: "TECHPRO", sourceReference: catalogSource },
  { code: "DEPED-TP-AFFI", name: "Agri-Fishery Business and Food Innovation", track: "TECHPRO", sourceReference: catalogSource },
  { code: "DEPED-TP-ACE", name: "Artisanry and Creative Enterprise", track: "TECHPRO", sourceReference: catalogSource },
  { code: "DEPED-TP-ASET", name: "Automotive and Small Engine Technologies", track: "TECHPRO", sourceReference: catalogSource },
  { code: "DEPED-TP-CBT", name: "Construction and Building Technology", track: "TECHPRO", sourceReference: catalogSource },
  { code: "DEPED-TP-CADT", name: "Creative Arts and Design Technology", track: "TECHPRO", sourceReference: catalogSource },
  { code: "DEPED-TP-HT", name: "Hospitality and Tourism", track: "TECHPRO", sourceReference: catalogSource },
  { code: "DEPED-TP-ICT", name: "ICT Support and Computer Programming Technologies", track: "TECHPRO", sourceReference: catalogSource },
  { code: "DEPED-TP-IT", name: "Industrial Technologies", track: "TECHPRO", sourceReference: catalogSource },
  { code: "DEPED-TP-MAR", name: "Maritime", track: "TECHPRO", sourceReference: catalogSource },
];

function entries(prefix: string, names: string[], classification: Classification, clusterCode: string | undefined, gradeLevel: "11" | "12", sourceReference: string, termApplicability: DepedShsCatalogEntry["termApplicability"], createOffering: boolean) {
  return names.map((description, index) => ({ code: `SSHS-G${gradeLevel}-${prefix}-${String(index + 1).padStart(2, "0")}`, description, gradeLevel, classification, clusterCode, sourceReference, termApplicability, createOffering }));
}

const core = ["Effective Communication", "General Mathematics", "General Science", "Life and Career Skills", "Mabisang Komunikasyon", "Pag-aaral ng Kasaysayan at Lipunang Pilipino"];
const academic = {
  "DEPED-ACA-ASSH": ["Art Criticism and Creative Markets", "Citizenship and Civic Engagement", "Contemporary Literature 1", "Contemporary Literature 2", "Creative Composition 1", "Creative Composition 2", "Creative Industries - Applied and Traditional Arts", "Creative Industries - Dance", "Creative Industries - Literary Arts", "Creative Industries - Media Arts", "Creative Industries - Music", "Creative Industries - Theater Arts", "Creative Industries - Visual Arts", "Filipino 1 - Wika at Komunikasyon sa Akademikong Filipino", "Filipino 2 - Filipino para sa Larang Teknikal Propesyonal", "Filipino 2 - Filipino sa Isports", "Filipino 2 - Filipino sa Sining at Disenyo", "Filipino Identity Through the Arts", "Introduction to Philosophy", "Leadership and Management in the Arts", "Malikhaing Pagsulat", "Performance Criticism and Creative Markets", "Philippine Governance, Philippine Politics and Governance", "Social Sciences Theory and Practice"],
  "DEPED-ACA-BE": ["Business 1 - Basic Accounting", "Business 2 - Business Finance and Income Taxation", "Business 3 - Business Economics", "Contemporary Marketing", "Entrepreneurship", "Introduction to Organization and Management"],
  "DEPED-ACA-STEM": ["Advanced Mathematics", "Basic Calculus", "Biology 1", "Biology 2", "Biology 3", "Biology 4", "Chemistry 1", "Chemistry 2", "Chemistry 3", "Chemistry 4", "Conceptual Biology and Earth and Space Science", "Conceptual Physics and Chemistry in Daily Life", "Database Management", "Earth and Space Science 1", "Earth and Space Science 2", "Earth and Space Science 3", "Earth and Space Science 4", "Empowerment Technologies", "Finite Mathematics 1", "Finite Mathematics 2", "Fundamentals of Data Analytics", "Physics 1", "Physics 2", "Physics 3", "Physics 4", "Pre-Calculus"],
  "DEPED-ACA-SHW": ["Exercise and Sports Programming", "First Aid", "Fundamentals of Basic Life Support", "Human Movement 1 - Basic Anatomy in Sports and Exercise", "Human Movement 2 - Motor Skills Development", "Physical Education 1 - Fitness and Recreation", "Physical Education 2 - Sports and Dance", "Sports Activity Management", "Sports Coaching", "Sports Officiating"],
  "DEPED-ACA-FE": ["Arts Apprenticeship - Dance", "Arts Apprenticeship - Literary Arts", "Arts Apprenticeship - Media Arts", "Arts Apprenticeship - Music", "Arts Apprenticeship - Theater Arts", "Arts Apprenticeship - Traditional Cultural Expressions", "Arts Apprenticeship - Visual Arts", "Design and Innovation", "In-Campus Field Exposure for Sports", "Research 1", "Research 2"],
};
const techPro = {
  "DEPED-TP-AWHC": ["Aesthetic Services (Beauty Care)", "Caregiving (Adult Care)", "Caregiving (Child Care)", "Hairdressing Services"],
  "DEPED-TP-AFFI": ["Agricultural Crops Production", "Agro-Entrepreneurship", "Aquaculture", "Fish Capture", "Food Processing", "Organic Agriculture Production", "Poultry Production - Chicken", "Ruminants Production", "Swine Production"],
  "DEPED-TP-ACE": ["Garments Artisanry", "Handicrafts (Weaving)"],
  "DEPED-TP-ASET": ["Driving and Automotive Servicing", "Motorcycle and Small Engine Servicing"],
  "DEPED-TP-CBT": ["Carpentry", "Construction Operation", "Manual Metal Arc Welding", "Technical Drafting"],
  "DEPED-TP-CADT": ["Animation", "Illustration", "Visual Graphic Design"],
  "DEPED-TP-HT": ["Bakery Operations", "Events Management Services", "Food and Beverage Operation", "Hotel Operation - Front Office Services", "Hotel Operation - Housekeeping Services", "Kitchen Operations", "Tourism Services"],
  "DEPED-TP-ICT": ["Broadband Installation", "Computer Programming (.NET Technology)", "Computer Programming (Java)", "Computer Programming (Oracle Database)", "Computer Systems Servicing", "Contact Center Services"],
  "DEPED-TP-IT": ["Domestic Refrigeration and Air Conditioning Servicing", "Electrical Installation and Maintenance", "Electronic Products Assembly and Servicing", "Photovoltaic Systems Installation"],
  "DEPED-TP-MAR": ["Marine Engineering at the Support Level", "Marine Transportation at the Support Level", "Ships Catering Services"],
};

export const depedShsCatalogEntries: DepedShsCatalogEntry[] = [
  ...entries("CORE", core, "CORE", undefined, "11", `${catalogSource}; authority: ${DEPED_SSHS_DO017_URL}`, "ALL_CONFIGURED_TERMS", true),
  ...Object.entries(academic).flatMap(([clusterCode, names], index) => entries(`AE${index + 1}`, names, "ACADEMIC_ELECTIVE", clusterCode, "11", catalogSource, "UNSPECIFIED", false)),
  ...Object.entries(techPro).flatMap(([clusterCode, names], index) => entries(`TP${index + 1}`, names, "TECHPRO_ELECTIVE", clusterCode, "11", catalogSource, "ALL_CONFIGURED_TERMS", true)),
  ...Object.entries(techPro).flatMap(([clusterCode, names], index) => entries(`TP${index + 1}`, names, "TECHPRO_ELECTIVE", clusterCode, "12", g12PilotSource, "ALL_CONFIGURED_TERMS", true)),
];
