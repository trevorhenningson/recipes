import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "json-schema-to-typescript";
import { ROOT, loadTree, readJson, validateTree, validators } from "./lib/tree.ts";

const { tree, errors } = loadTree();
errors.push(...validateTree(tree));
if (errors.length) {
  for (const e of errors) console.error(e);
  process.exit(1);
}

const dist = join(ROOT, "dist");
mkdirSync(dist, { recursive: true });

const recipes = tree.recipes
  .map((r) => r.data as { slug: string })
  .sort((a, b) => a.slug.localeCompare(b.slug));
const index = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  ingredients: tree.ingredients,
  tags: tree.tags,
  recipes,
};
if (!validators().index(index)) {
  console.error("Built index does not match RecipeIndex", validators().index.errors);
  process.exit(1);
}
writeFileSync(join(dist, "recipes.index.json"), JSON.stringify(index));
for (const f of ["ingredients.json", "tags.json"]) copyFileSync(join(ROOT, f), join(dist, f));
copyFileSync(join(ROOT, "schema/recipe.schema.json"), join(dist, "recipe.schema.json"));

// TypeScript types for the site, generated from the schema (source of truth).
const schema = readJson(join(ROOT, "schema/recipe.schema.json")) as Record<string, unknown>;
const { $ref: _root, ...defsOnly } = schema;
const ts = await compile({ ...defsOnly, title: "RecipeSchema", type: "object" } as never, "RecipeSchema", {
  bannerComment:
    "/* Generated from schema/recipe.schema.json in trevorhenningson/recipes. Do not edit by hand.\n   Regenerate with `npm run build` there and copy dist/types.ts here. */",
  unreachableDefinitions: true,
  additionalProperties: false,
  format: true,
  style: { singleQuote: false, semi: true },
});
writeFileSync(join(dist, "types.ts"), ts);

// Static landing page so the Pages root is not a 404.
writeFileSync(
  join(dist, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Recipes data</title><p>Recipe data for <a href="https://trevorhenningson.net/recipeApp">trevorhenningson.net/recipeApp</a>. Files: <a href="recipes.index.json">recipes.index.json</a>, <a href="ingredients.json">ingredients.json</a>, <a href="tags.json">tags.json</a>, <a href="recipe.schema.json">recipe.schema.json</a>.</p>`,
);

console.log(`Built dist/recipes.index.json with ${recipes.length} recipes.`);
