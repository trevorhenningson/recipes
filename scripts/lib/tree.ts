import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { Ajv } from "ajv";
import addFormatsImport from "ajv-formats";
import type { ErrorObject, ValidateFunction } from "ajv";

// ajv-formats ships CJS; under NodeNext the default export arrives wrapped.
const addFormats = ((addFormatsImport as unknown as { default?: unknown }).default ??
  addFormatsImport) as unknown as (ajv: Ajv) => Ajv;

export const ROOT = new URL("../../", import.meta.url).pathname;

export interface RecipeFile {
  file: string; // repo-relative path, for messages
  data: unknown;
}

export interface Tree {
  tags: unknown;
  ingredients: unknown;
  recipes: RecipeFile[];
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Loads tags, ingredients and every recipes/*.json from a repo root. */
export function loadTree(root = ROOT): { tree: Tree; errors: string[] } {
  const errors: string[] = [];
  const read = (rel: string): unknown => {
    try {
      return readJson(join(root, rel));
    } catch (e) {
      errors.push(`${rel}: ${(e as Error).message}`);
      return undefined;
    }
  };
  const dir = join(root, "recipes");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  return {
    tree: {
      tags: read("tags.json"),
      ingredients: read("ingredients.json"),
      recipes: files.map((f) => ({ file: `recipes/${f}`, data: read(`recipes/${f}`) })),
    },
    errors,
  };
}

let cached: { recipe: ValidateFunction; ingredients: ValidateFunction; tags: ValidateFunction; index: ValidateFunction } | undefined;

export function validators(root = ROOT) {
  if (cached) return cached;
  const schema = readJson(join(root, "schema/recipe.schema.json")) as object;
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(schema, "recipe");
  const get = (ref: string) => {
    const fn = ajv.getSchema(ref);
    if (!fn) throw new Error(`schema ref not found: ${ref}`);
    return fn;
  };
  cached = {
    recipe: get("recipe"),
    ingredients: get("recipe#/definitions/IngredientList"),
    tags: get("recipe#/definitions/TagList"),
    index: get("recipe#/definitions/RecipeIndex"),
  };
  return cached;
}

/** "/components/0/ingredients/2/id" -> "components[0].ingredients[2].id" */
export function jsonPath(instancePath: string): string {
  if (!instancePath) return "(root)";
  return instancePath
    .split("/")
    .slice(1)
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((acc, part) => (/^\d+$/.test(part) ? `${acc}[${part}]` : acc ? `${acc}.${part}` : part), "");
}

export function formatAjv(file: string, errs: ErrorObject[] | null | undefined): string[] {
  return (errs ?? [])
    // oneOf on unit produces noisy companion errors; keep the useful ones.
    .filter((e) => e.keyword !== "oneOf")
    .map((e) => {
      const extra =
        e.keyword === "additionalProperties"
          ? ` "${(e.params as { additionalProperty: string }).additionalProperty}"`
          : e.keyword === "enum"
            ? ` (${(e.params as { allowedValues: unknown[] }).allowedValues.join(", ")})`
            : "";
      return `${file}: ${jsonPath(e.instancePath)} ${e.message}${extra}`;
    });
}

interface Named { id: string; name?: string }
interface Line { id: string }
interface RecipeLike { slug: string; tags: string[]; components: { ingredients: Line[] }[] }

/** Schema checks plus the cross-file rules. Returns one message per problem. */
export function validateTree(tree: Tree, root = ROOT): string[] {
  const v = validators(root);
  const errors: string[] = [];

  if (!v.tags(tree.tags)) errors.push(...formatAjv("tags.json", v.tags.errors));
  if (!v.ingredients(tree.ingredients)) errors.push(...formatAjv("ingredients.json", v.ingredients.errors));

  const tagIds = new Set<string>();
  for (const t of (Array.isArray(tree.tags) ? tree.tags : []) as Named[]) {
    if (tagIds.has(t.id)) errors.push(`tags.json: duplicate tag id "${t.id}"`);
    tagIds.add(t.id);
  }
  const ingredientIds = new Set<string>();
  for (const i of (Array.isArray(tree.ingredients) ? tree.ingredients : []) as Named[]) {
    if (ingredientIds.has(i.id)) errors.push(`ingredients.json: duplicate ingredient id "${i.id}"`);
    ingredientIds.add(i.id);
  }

  const slugs = new Map<string, string>();
  for (const { file, data } of tree.recipes) {
    if (data === undefined) continue; // parse error already reported
    if (!v.recipe(data)) {
      errors.push(...formatAjv(file, v.recipe.errors));
      continue;
    }
    const r = data as RecipeLike;
    const expected = basename(file, ".json");
    if (r.slug !== expected) errors.push(`${file}: slug "${r.slug}" must equal the file name "${expected}"`);
    if (slugs.has(r.slug)) errors.push(`${file}: duplicate slug "${r.slug}" (also in ${slugs.get(r.slug)})`);
    slugs.set(r.slug, file);
    r.tags.forEach((t, i) => {
      if (!tagIds.has(t)) errors.push(`${file}: tags[${i}] "${t}" not in tags.json`);
    });
    r.components.forEach((c, ci) =>
      c.ingredients.forEach((line, li) => {
        if (!ingredientIds.has(line.id))
          errors.push(`${file}: components[${ci}].ingredients[${li}].id "${line.id}" not in ingredients.json`);
      }),
    );
  }
  return errors;
}
