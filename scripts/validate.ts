import { loadTree, validateTree } from "./lib/tree.ts";

const { tree, errors } = loadTree();
errors.push(...validateTree(tree));
if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
console.log(`OK: ${tree.recipes.length} recipes, ${(tree.ingredients as unknown[]).length} ingredients, ${(tree.tags as unknown[]).length} tags.`);
