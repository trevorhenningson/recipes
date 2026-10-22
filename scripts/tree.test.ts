import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTree, validateTree, jsonPath, type Tree } from "./lib/tree.ts";

const base = loadTree().tree;
const clone = <T>(x: T): T => structuredClone(x);
const tikka = () => clone(base.recipes.find((r) => r.file.endsWith("chicken-tikka-masala.json"))!.data) as any;
const withRecipe = (data: unknown, file = "recipes/chicken-tikka-masala.json"): Tree => ({
  ...base,
  recipes: [{ file, data }],
});
const errs = (t: Tree) => validateTree(t);

test("the committed tree is valid", () => assert.deepEqual(errs(base), []));

test("jsonPath formats array indexes", () =>
  assert.equal(jsonPath("/components/0/ingredients/2/id"), "components[0].ingredients[2].id"));

test("unknown tag names the file and path", () => {
  const r = tikka();
  r.tags = ["chicken", "indian"];
  assert.deepEqual(errs(withRecipe(r)), ['recipes/chicken-tikka-masala.json: tags[1] "indian" not in tags.json']);
});

test("unknown ingredient id", () => {
  const r = tikka();
  r.components[0].ingredients[2].id = "scalion";
  assert.match(errs(withRecipe(r))[0], /components\[0\]\.ingredients\[2\]\.id "scalion" not in ingredients\.json/);
});

test("quantity 0 is rejected", () => {
  const r = tikka();
  r.components[0].ingredients[0].quantity = 0;
  assert.match(errs(withRecipe(r)).join("\n"), /components\[0\]\.ingredients\[0\]\.quantity must be > 0/);
});

test("extra field is rejected", () => {
  const r = tikka();
  r.rating = 5;
  assert.match(errs(withRecipe(r)).join("\n"), /must NOT have additional properties "rating"/);
});

test("unknown unit lists allowed values", () => {
  const r = tikka();
  r.components[0].ingredients[0].unit = "pounds";
  assert.match(errs(withRecipe(r)).join("\n"), /unit must be equal to one of the allowed values/);
});

test("slug must equal file name", () => {
  assert.match(errs(withRecipe(tikka(), "recipes/other.json")).join("\n"), /must equal the file name "other"/);
});

test("duplicate slugs are reported", () => {
  const t: Tree = { ...base, recipes: [
    { file: "recipes/chicken-tikka-masala.json", data: tikka() },
    { file: "recipes/chicken-tikka-masala.json", data: tikka() },
  ] };
  assert.match(errs(t).join("\n"), /duplicate slug/);
});

test("empty steps and missing tags are rejected", () => {
  const r = tikka();
  r.steps = ["  "];
  r.tags = [];
  const out = errs(withRecipe(r)).join("\n");
  assert.match(out, /steps\[0\] must match pattern/);
  assert.match(out, /tags must NOT have fewer than 1 items/);
});
