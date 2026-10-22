# Recipes

The recipe collection behind [trevorhenningson.net/recipeApp](https://trevorhenningson.net/recipeApp). Each recipe is one JSON file; GitHub Actions validate them and publish a single index to GitHub Pages, which the site fetches at runtime.

## Layout

```
recipes/<slug>.json        one recipe per file; the file name equals its slug
ingredients.json           canonical ingredient list (ids drive filtering and grocery lists)
tags.json                  the fixed tag list
schema/recipe.schema.json  JSON Schema for every record type (source of truth)
scripts/                   validate, build, issue-to-pr
```

## Published files

Built by `npm run build` into `dist/` and deployed to `https://trevorhenningson.github.io/recipes/`:

| File | Contents |
| --- | --- |
| `recipes.index.json` | `{ schemaVersion, generatedAt, ingredients, tags, recipes }` |
| `ingredients.json`, `tags.json`, `recipe.schema.json` | Vocabularies and schema, used by the recipe builder |
| `types.ts` | TypeScript types generated from the schema, copied into the site |

## Commands

```bash
npm install
npm run validate   # schema + cross-file checks on every recipe
npm test           # validator and suggestion-parser tests
npm run build      # writes dist/
```

## Rules the validator enforces

- The file name equals `slug`, and slugs are unique.
- Every tag exists in `tags.json`, and every ingredient `id` exists in `ingredients.json`.
- `unit` is from the fixed list or null, and `quantity` is null or greater than zero.
- At least one component with one ingredient, and at least one non-empty step.
- No fields beyond those in the schema.

`gramsPerCup` on an ingredient enables mass/volume conversion in the app's unit toggle. Values come from standard baking weight charts and are approximate; leave the field out when an ingredient has no reliable density.

## Suggestions

See [CONTRIBUTING.md](CONTRIBUTING.md). Suggestions arrive as issues; a workflow validates them and opens a pull request.

**Known limitation:** pull requests opened by the workflow's built-in `GITHUB_TOKEN` do not trigger the CI workflow. The suggestion workflow runs the same validation before it opens the pull request, and CI runs again when the merge lands on `main`.

## Licence

Recipe text and data are licensed under [CC BY 4.0](LICENSE).
