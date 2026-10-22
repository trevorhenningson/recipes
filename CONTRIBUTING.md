# Adding a recipe

There are two ways in. Both end with a pull request that the maintainer reviews and merges.

## 1. The recipe builder (no Git needed)

1. Open the [recipe builder](https://trevorhenningson.net/recipeApp/suggest).
2. Paste a recipe into "Import from text" or fill in the form. Pick ingredients from the list; use "Add new ingredient" only when nothing fits.
3. When validation passes, click **Suggest on GitHub**. A pre-filled issue opens; submit it.
4. A workflow checks the suggestion. If something is wrong it comments on the issue; edit the issue and it re-runs. If it passes, it opens a pull request.

You need a GitHub account to submit the issue.

## 2. A pull request

1. Add `recipes/<slug>.json`. Copy an existing recipe as a template.
2. If you need an ingredient that does not exist, add it to `ingredients.json` in the same pull request: a lowercase, hyphenated, singular `id`, a `name`, and a `category`.
3. Run `npm run validate` and open the pull request.

## Conventions

- Write quantities as the recipe was written. US customary is the default; metric is fine where it is natural (85 g chocolate).
- Put preparation in `prep` ("diced") and anything else in `note` ("28 oz can"), never in the ingredient id.
- Mark garnishes and extras `"optional": true`. Optional ingredients still hide a recipe when someone excludes them.
- Use `"quantity": null` for "to taste".
