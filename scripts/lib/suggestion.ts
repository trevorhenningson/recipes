import { validateTree, type Tree } from "./tree.ts";

/** Labels used in .github/ISSUE_TEMPLATE/recipe-suggestion.yml. Keep in sync. */
export const LABELS = {
  recipe: "Recipe JSON",
  newIngredients: "New ingredients",
  notes: "Notes for the reviewer",
} as const;

export interface ParsedIssue {
  recipeText: string | null;
  newIngredientsText: string | null;
  notes: string | null;
}

const NO_RESPONSE = "_No response_";

/** Splits a GitHub issue-form body into its "### Label" sections. */
export function sections(body: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = body.replace(/\r\n/g, "\n").split(/^###\s+(.+)$/m);
  for (let i = 1; i < parts.length; i += 2) out.set(parts[i].trim(), (parts[i + 1] ?? "").trim());
  return out;
}

function unfence(text: string | undefined): string | null {
  if (!text || text === NO_RESPONSE) return null;
  const m = text.match(/```[a-z]*\s*\n([\s\S]*?)\n?```/i);
  const inner = (m ? m[1] : text).trim();
  return inner && inner !== NO_RESPONSE ? inner : null;
}

export function parseIssueBody(body: string): ParsedIssue {
  const s = sections(body);
  const notes = s.get(LABELS.notes);
  return {
    recipeText: unfence(s.get(LABELS.recipe)),
    newIngredientsText: unfence(s.get(LABELS.newIngredients)),
    notes: notes && notes !== NO_RESPONSE ? notes : null,
  };
}

export interface Applied {
  errors: string[];
  slug?: string;
  title?: string;
  recipe?: unknown;
  ingredients?: { id: string; name: string }[];
  addedIngredientIds: string[];
}

/** Applies a suggestion to a copy of the tree and validates the result. Pure. */
export function applySuggestion(tree: Tree, parsed: ParsedIssue): Applied {
  const errors: string[] = [];
  const addedIngredientIds: string[] = [];
  if (!parsed.recipeText) return { errors: [`"${LABELS.recipe}" is empty.`], addedIngredientIds };

  let recipe: { slug?: unknown; title?: unknown };
  try {
    recipe = JSON.parse(parsed.recipeText);
  } catch (e) {
    return { errors: [`${LABELS.recipe}: not valid JSON (${(e as Error).message})`], addedIngredientIds };
  }
  const slug = typeof recipe?.slug === "string" ? recipe.slug : "";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    return { errors: [`${LABELS.recipe}: "slug" must be lowercase words joined by hyphens.`], addedIngredientIds };
  const file = `recipes/${slug}.json`;
  if (tree.recipes.some((r) => r.file === file))
    errors.push(`${file} already exists. To change an existing recipe, open a pull request instead.`);

  const ingredients = structuredClone(tree.ingredients) as { id: string; name: string }[];
  if (parsed.newIngredientsText) {
    let extra: unknown;
    try {
      extra = JSON.parse(parsed.newIngredientsText);
    } catch (e) {
      return { errors: [`${LABELS.newIngredients}: not valid JSON (${(e as Error).message})`], addedIngredientIds };
    }
    const list = (Array.isArray(extra) ? extra : [extra]) as { id: string; name: string }[];
    for (const ing of list) {
      const existing = ingredients.find((i) => i.id === ing?.id);
      if (existing) {
        if (existing.name.toLowerCase() !== String(ing.name ?? "").toLowerCase())
          errors.push(`${LABELS.newIngredients}: id "${ing.id}" already exists as "${existing.name}".`);
        continue; // same ingredient proposed twice: ignore
      }
      ingredients.push(ing);
      addedIngredientIds.push(ing?.id);
    }
    ingredients.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  const next: Tree = {
    tags: tree.tags,
    ingredients,
    recipes: [...tree.recipes.filter((r) => r.file !== file), { file, data: recipe }],
  };
  errors.push(...validateTree(next));
  return {
    errors,
    slug,
    title: typeof recipe.title === "string" ? recipe.title : slug,
    recipe,
    ingredients,
    addedIngredientIds,
  };
}

/** Same one-object-per-line layout as the committed ingredients.json. */
export function formatIngredients(list: unknown[]): string {
  return "[\n" + list.map((o) => "  " + JSON.stringify(o)).join(",\n") + "\n]\n";
}
