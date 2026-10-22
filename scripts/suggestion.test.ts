import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTree } from "./lib/tree.ts";
import { applySuggestion, parseIssueBody } from "./lib/suggestion.ts";

const tree = loadTree().tree;
const recipe = {
  slug: "garlic-butter-shrimp",
  title: "Garlic Butter Shrimp",
  tags: ["seafood", "quick"],
  servings: 2,
  components: [{ name: null, ingredients: [
    { id: "shrimp", quantity: 1, unit: "lb" },
    { id: "butter", quantity: 3, unit: "tbsp" },
    { id: "garlic", quantity: 4, unit: "clove", prep: "minced" },
    { id: "old-bay-seasoning", quantity: 1, unit: "tsp" },
  ] }],
  steps: ["Melt butter, add garlic, add shrimp, cook 3 minutes."],
};
const issue = (r: unknown, extra: string) => `### Recipe JSON

\`\`\`json
${JSON.stringify(r, null, 2)}
\`\`\`

### New ingredients

${extra}

### Notes for the reviewer

Weeknight favourite.`;

test("parses issue-form sections", () => {
  const p = parseIssueBody(issue(recipe, "_No response_"));
  assert.equal(JSON.parse(p.recipeText!).slug, "garlic-butter-shrimp");
  assert.equal(p.newIngredientsText, null);
  assert.equal(p.notes, "Weeknight favourite.");
});

test("valid suggestion with one new ingredient touches two files", () => {
  const extra = '```json\n[{"id":"old-bay-seasoning","name":"Old Bay seasoning","category":"spices"}]\n```';
  const r = applySuggestion(tree, parseIssueBody(issue(recipe, extra)));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.addedIngredientIds, ["old-bay-seasoning"]);
});

test("unknown ingredient without a proposal fails", () => {
  const r = applySuggestion(tree, parseIssueBody(issue(recipe, "_No response_")));
  assert.match(r.errors.join("\n"), /"old-bay-seasoning" not in ingredients\.json/);
});

test("unknown tag fails with a readable message", () => {
  const extra = '```json\n[{"id":"old-bay-seasoning","name":"Old Bay seasoning","category":"spices"}]\n```';
  const r = applySuggestion(tree, parseIssueBody(issue({ ...recipe, tags: ["cajun"] }, extra)));
  assert.match(r.errors.join("\n"), /tags\[0\] "cajun" not in tags\.json/);
});

test("existing slug is refused", () => {
  const r = applySuggestion(tree, parseIssueBody(issue({ ...recipe, slug: "black-bean-soup" }, "_No response_")));
  assert.match(r.errors.join("\n"), /already exists/);
});

test("conflicting ingredient id is refused", () => {
  const extra = '```json\n[{"id":"garlic","name":"Wild garlic","category":"produce"}]\n```';
  const r = applySuggestion(tree, parseIssueBody(issue(recipe, extra)));
  assert.match(r.errors.join("\n"), /id "garlic" already exists as "Garlic"/);
});

test("broken JSON is reported, not thrown", () => {
  const r = applySuggestion(tree, parseIssueBody("### Recipe JSON\n\n```json\n{oops\n```"));
  assert.match(r.errors[0], /not valid JSON/);
});
