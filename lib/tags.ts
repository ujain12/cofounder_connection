// lib/tags.ts
// Central tag definitions used across profile, matches, and search agent

export type TagCategory =
  | "Domain Expertise"
  | "Business Skills"
  | "Founder Type"
  | "Industry Focus"
  | "Stage Experience";

export type Tag = {
  id: string;
  label: string;
  category: TagCategory;
};

export const ALL_TAGS: Tag[] = [
  // Domain Expertise
  { id: "ai_ml",        label: "AI / ML",              category: "Domain Expertise" },
  { id: "data_science", label: "Data Science",          category: "Domain Expertise" },
  { id: "full_stack",   label: "Full Stack Eng",        category: "Domain Expertise" },
  { id: "mobile",       label: "Mobile Dev",            category: "Domain Expertise" },
  { id: "blockchain",   label: "Blockchain / Web3",     category: "Domain Expertise" },
  { id: "cloud_devops", label: "Cloud / DevOps",        category: "Domain Expertise" },
  { id: "cybersecurity",label: "Cybersecurity",         category: "Domain Expertise" },
  { id: "design_ux",    label: "Design / UX",           category: "Domain Expertise" },

  // Business Skills
  { id: "product",      label: "Product Management",    category: "Business Skills" },
  { id: "growth",       label: "Growth / Marketing",    category: "Business Skills" },
  { id: "sales",        label: "Sales / BD",            category: "Business Skills" },
  { id: "finance",      label: "Finance / CFO",         category: "Business Skills" },
  { id: "fundraising",  label: "Fundraising",           category: "Business Skills" },
  { id: "operations",   label: "Operations",            category: "Business Skills" },
  { id: "legal",        label: "Legal / Compliance",    category: "Business Skills" },

  // Founder Type
  { id: "technical",    label: "Technical Founder",     category: "Founder Type" },
  { id: "business",     label: "Business Founder",      category: "Founder Type" },
  { id: "creative",     label: "Creative Director",     category: "Founder Type" },
  { id: "domain_exp",   label: "Domain Expert",         category: "Founder Type" },
  { id: "serial",       label: "Serial Entrepreneur",   category: "Founder Type" },
  { id: "first_time",   label: "First-Time Founder",    category: "Founder Type" },

  // Industry Focus
  { id: "healthtech",   label: "HealthTech",            category: "Industry Focus" },
  { id: "fintech",      label: "FinTech",               category: "Industry Focus" },
  { id: "edtech",       label: "EdTech",                category: "Industry Focus" },
  { id: "climate",      label: "Climate / GreenTech",   category: "Industry Focus" },
  { id: "saas",         label: "SaaS / B2B",            category: "Industry Focus" },
  { id: "consumer",     label: "Consumer",              category: "Industry Focus" },
  { id: "deeptech",     label: "DeepTech",              category: "Industry Focus" },
  { id: "ecommerce",    label: "E-Commerce",            category: "Industry Focus" },

  // Stage Experience
  { id: "idea_stage",   label: "Idea Stage",            category: "Stage Experience" },
  { id: "mvp_builder",  label: "MVP Builder",           category: "Stage Experience" },
  { id: "early_revenue",label: "Early Revenue",         category: "Stage Experience" },
  { id: "scaling",      label: "Scaling",               category: "Stage Experience" },
  { id: "exited",       label: "Exited Before",         category: "Stage Experience" },
];

export const CATEGORIES: TagCategory[] = [
  "Domain Expertise",
  "Business Skills",
  "Founder Type",
  "Industry Focus",
  "Stage Experience",
];

export const CATEGORY_COLORS: Record<TagCategory, { bg: string; border: string; text: string; activeBg: string; activeBorder: string; activeText: string }> = {
  "Domain Expertise": {
    bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.2)", text: "#818cf8",
    activeBg: "rgba(99,102,241,0.25)", activeBorder: "#6366f1", activeText: "#c7d2fe",
  },
  "Business Skills": {
    bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", text: "#34d399",
    activeBg: "rgba(16,185,129,0.25)", activeBorder: "#10b981", activeText: "#6ee7b7",
  },
  "Founder Type": {
    bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", text: "#fbbf24",
    activeBg: "rgba(245,158,11,0.25)", activeBorder: "#f59e0b", activeText: "#fde68a",
  },
  "Industry Focus": {
    bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.2)", text: "#22d3ee",
    activeBg: "rgba(6,182,212,0.25)", activeBorder: "#06b6d4", activeText: "#a5f3fc",
  },
  "Stage Experience": {
    bg: "rgba(244,63,94,0.08)", border: "rgba(244,63,94,0.2)", text: "#fb7185",
    activeBg: "rgba(244,63,94,0.25)", activeBorder: "#f43f5e", activeText: "#fda4af",
  },
};

export function getTagsByCategory(category: TagCategory): Tag[] {
  return ALL_TAGS.filter(t => t.category === category);
}

export function getTagByLabel(label: string): Tag | undefined {
  return ALL_TAGS.find(t => t.label === label);
}

export function getTagLabels(tagIds: string[]): string[] {
  return tagIds.map(id => ALL_TAGS.find(t => t.id === id)?.label ?? id);
}