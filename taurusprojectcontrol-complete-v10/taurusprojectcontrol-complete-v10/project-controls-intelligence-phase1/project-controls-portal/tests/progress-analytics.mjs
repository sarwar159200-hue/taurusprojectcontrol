import { strict as assert } from "node:assert";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.endsWith(".ts") &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !/\.[a-z]+$/i.test(specifier)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  }
});

const analyticsUrl = pathToFileURL(new URL("../lib/progress-analytics.ts", import.meta.url).pathname).href;
const {
  evaluateProgress,
  makeProgressCurve,
  projectWeekNumber
} = await import(analyticsUrl);

assert.equal(projectWeekNumber("2026-01-15"), 29);
assert.equal(projectWeekNumber("2026-02-05"), 32);

const source = [
  { frequency: "weekly", area: "Engineering", discipline: "Engineering", subdiscipline: null, measure: "baseline", periodDate: "2026-02-05", incrementalValue: null, cumulativeValue: 0.40 },
  { frequency: "weekly", area: "Engineering", discipline: "Engineering", subdiscipline: null, measure: "actual", periodDate: "2026-02-05", incrementalValue: null, cumulativeValue: 0.36 },
  { frequency: "weekly", area: "Engineering", discipline: "Engineering", subdiscipline: null, measure: "baseline", periodDate: "2026-02-12", incrementalValue: null, cumulativeValue: 0.44 }
];

const weekly = makeProgressCurve(source, "weekly", "all");
assert.deepEqual(weekly.slice(0, 4).map((point) => point.date), [
  "2026-01-15", "2026-01-22", "2026-01-29", "2026-02-05"
]);
const evaluated = evaluateProgress(weekly);
assert.equal(evaluated.date, "2026-02-05");
assert(Math.abs(evaluated.spi - 0.9) < 0.0000001);

console.log("Progress analytics checks passed.");
