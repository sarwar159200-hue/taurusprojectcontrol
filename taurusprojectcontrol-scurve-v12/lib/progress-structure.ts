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
    "E&I Works",
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

// Controlled progress weights supplied by Taurus Project Control. The keys use
// the portal's canonical labels; "Mechanical Equipment" corresponds to the
// workbook row labelled "Mechanical Equipments".
export const PROGRESS_WEIGHTS: Record<string, Readonly<Record<string, number>>> = {
  Overall: {
    Engineering: 0.08,
    Procurement: 0.45,
    Construction: 0.45,
    Mobilization: 0.02
  },
  Engineering: {
    "Plant Design": 0.20,
    "Architecture & Civil": 0.20,
    Electrical: 0.23,
    "I&C": 0.12,
    Process: 0.10,
    Mechanical: 0.15
  },
  Procurement: {
    "Key Equipment": 0.5542,
    Civil: 0.0389,
    Electrical: 0.1442,
    "Instrumentation Control": 0.0504,
    Mechanical: 0.1772,
    PD: 0.0351
  },
  Construction: {
    Earthworks: 0.0320,
    "Civil Works": 0.1815,
    "Steel Erection": 0.0738,
    Architectural: 0.0376,
    "Piping Works": 0.1100,
    "E&I Works": 0.2000,
    "Mechanical Equipment": 0.2804,
    "ST & GT Erection Works": 0.0196,
    "H.V.A.C Works": 0.0060,
    "Fire Fighting Works": 0.0100,
    "Heat Insulation Works": 0.0200,
    "Painting & Coating Works": 0.0070,
    "Start-Up": 0.0220
  }
};

export function progressWeight(main: string, child: string) {
  return PROGRESS_WEIGHTS[main]?.[child] ?? null;
}

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
