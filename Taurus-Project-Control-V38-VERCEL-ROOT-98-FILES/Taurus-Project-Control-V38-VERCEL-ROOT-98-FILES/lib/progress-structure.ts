import { normalize } from "./importers/workbook-utils";

export const DISCIPLINE_ORDER = [
  "Overall",
  "Engineering",
  "Procurement",
  "Construction",
  "Mobilization"
] as const;

export const MONTHLY_SUBDISCIPLINES: Record<string, readonly string[]> = {
  Engineering: [
    "Plant Design",
    "Architecture & Civil",
    "Electrical",
    "I&C",
    "Process",
    "Mechanical"
  ],
  Procurement: [
    "Key Equipment",
    "Civil",
    "Electrical",
    "Instrumentation Control",
    "Mechanical",
    "PD"
  ],
  Construction: [
    "Earthworks",
    "Civil Works",
    "Steel Erection",
    "Architectural",
    "Piping Works",
    "Electrical Works",
    "I&C Works",
    "Mechanical Equipment",
    "ST & GT Erection Works",
    "H.V.A.C Works",
    "Fire Fighting Works",
    "Heat Insulation Works",
    "Painting & Coating Works",
    "Start-Up"
  ]
};

export const WEEKLY_SUBDISCIPLINES: Record<string, readonly string[]> = {
  Engineering: MONTHLY_SUBDISCIPLINES.Engineering,
  Construction: MONTHLY_SUBDISCIPLINES.Construction
};

const MAIN_DISCIPLINES = new Map(
  DISCIPLINE_ORDER.map((label) => [normalize(label), label])
);

const SUBDISCIPLINE_ALIASES = new Map<string, string>([
  ["plant design", "Plant Design"],
  ["architecture & civil", "Architecture & Civil"],
  ["architecture and civil", "Architecture & Civil"],
  ["architectur", "Architecture & Civil"],
  ["electrical", "Electrical"],
  ["i&c", "I&C"],
  ["instrumentation control", "Instrumentation Control"],
  ["instrumentation c", "Instrumentation Control"],
  ["process", "Process"],
  ["mechanical", "Mechanical"],
  ["key equipment", "Key Equipment"],
  ["civil", "Civil"],
  ["pd", "PD"],
  ["earthworks", "Earthworks"],
  ["civil works", "Civil Works"],
  ["steel erection", "Steel Erection"],
  ["architectural", "Architectural"],
  ["piping works", "Piping Works"],
  ["e&i works", "E&I Works"],
  ["electrical works", "Electrical Works"],
  ["i&c works", "I&C Works"],
  ["mechanical equipment", "Mechanical Equipment"],
  ["mechanical equipments", "Mechanical Equipment"],
  ["st & gt erection", "ST & GT Erection Works"],
  ["st & gt erection works", "ST & GT Erection Works"],
  ["h.v.a.c works", "H.V.A.C Works"],
  ["hvac works", "H.V.A.C Works"],
  ["fire fighting works", "Fire Fighting Works"],
  ["heat insulation works", "Heat Insulation Works"],
  ["painting & coating works", "Painting & Coating Works"],
  ["painting and coating works", "Painting & Coating Works"],
  ["start-up", "Start-Up"],
  ["start up", "Start-Up"]
]);

export function canonicalDiscipline(value: string) {
  return MAIN_DISCIPLINES.get(normalize(value)) ?? value.trim();
}

export function canonicalSubdiscipline(value: string) {
  return SUBDISCIPLINE_ALIASES.get(normalize(value)) ?? value.trim();
}

export function progressOrder(value: string, preferred: readonly string[]) {
  const index = preferred.indexOf(value);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}
