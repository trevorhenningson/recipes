/**
 * Turns a "Suggest a recipe" issue into file changes.
 * Reads the issue body from $ISSUE_BODY (or a file path argument for local testing).
 * On success writes recipes/<slug>.json (+ ingredients.json), a PR body, and step outputs.
 * On failure writes a Markdown error report and exits 1.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadTree } from "./lib/tree.ts";
import { applySuggestion, formatIngredients, parseIssueBody } from "./lib/suggestion.ts";

const body = process.argv[2] ? readFileSync(process.argv[2], "utf8") : (process.env.ISSUE_BODY ?? "");
const issue = process.env.ISSUE_NUMBER ?? "local";
const outDir = process.env.RUNNER_TEMP ?? ROOT;

const output = (key: string, value: string) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
};

const parsed = parseIssueBody(body);
const { tree, errors: loadErrors } = loadTree();
const result = applySuggestion(tree, parsed);
const errors = [...loadErrors, ...result.errors];

if (errors.length) {
  const report = [
    "The suggestion could not be turned into a pull request yet:",
    "",
    ...errors.map((e) => `- ${e.replace(/`/g, "'")}`),
    "",
    "Edit the issue to fix these and the check will run again. The [recipe builder](https://trevorhenningson.net/recipeApp/suggest) produces valid JSON.",
  ].join("\n");
  writeFileSync(join(outDir, "suggestion-errors.md"), report);
  console.error(report);
  process.exit(1);
}

writeFileSync(join(ROOT, `recipes/${result.slug}.json`), JSON.stringify(result.recipe, null, 2) + "\n");
if (result.addedIngredientIds.length) writeFileSync(join(ROOT, "ingredients.json"), formatIngredients(result.ingredients!));

const prBody = [
  `Adds **${result.title}** from #${issue}.`,
  "",
  `- \`recipes/${result.slug}.json\``,
  ...(result.addedIngredientIds.length ? [`- New ingredients: ${result.addedIngredientIds.map((i) => `\`${i}\``).join(", ")}`] : []),
  "",
  "The suggestion workflow already ran schema and cross-file validation on these files.",
  "Pull requests opened by `GITHUB_TOKEN` do not trigger CI, so CI runs again on merge to `main`.",
  ...(parsed.notes ? ["", "**Submitter notes**", "", parsed.notes] : []),
  "",
  `Closes #${issue}`,
].join("\n");
writeFileSync(join(outDir, "pr-body.md"), prBody);

output("slug", result.slug!);
output("title", result.title!.replace(/[\r\n]/g, " "));
output("body_path", join(outDir, "pr-body.md"));
console.log(`OK: recipes/${result.slug}.json${result.addedIngredientIds.length ? " + ingredients.json" : ""}`);
