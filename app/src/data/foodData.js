import { useEffect, useState } from 'react'

/**
 * The SnapWell food data layer.
 *
 * Loads the AUSNUT-backed dataset in public/data/food_data and turns it into
 * the shapes the recommendation screens need. It replaced a hard-coded array
 * of six demo recipes with invented nutrition values.
 *
 * What the dataset does and does not contain matters, and the UI must not
 * paper over the gap:
 *   - 100 recipes, each a list of SnapWell ingredient labels plus steps.
 *   - Real per-100 g AUSNUT nutrition for all 49 mapped ingredient labels.
 *   - NO per-ingredient quantities, NO cooking times, NO recipe images.
 * Because there are no quantities, a per-serving recipe total cannot be
 * calculated from this data. Nutrition is therefore reported per ingredient,
 * per 100 g, exactly as AUSNUT states it — never summed into a made-up total.
 *
 * `recipe-ingredient-map-v1.json` is deliberately not fetched: its 434 rows
 * were verified to agree with `ingredient-nutrition-v1.json` on every AUSNUT
 * key, so it is derivable and would cost 70 KB to no benefit.
 */

const RECIPES_URL = '/data/food_data/recipes-v1.json'
const NUTRITION_URL = '/data/food_data/ingredient-nutrition-v1.json'
const LINKS_URL = '/data/food_data/missing-ingredient-links-v1.json'
const ATTRIBUTION_URL = '/data/food_data/attribution-v1.json'

/**
 * Preferences the recipe dataset can answer from its own `dietary_tags`.
 * Only these three tags exist across all 100 recipes.
 */
const REQUIRED_TAG = {
  Vegetarian: 'vegetarian',
  'Low-calorie': 'low-calorie',
  'High-protein': 'high-protein',
}

/**
 * Preferences the dataset has no tag for. These are derived from the
 * ingredient labels a recipe uses, so the reasoning stays visible and
 * reviewable here instead of being buried in a screen.
 */
const ANIMAL_PRODUCTS = [
  'bacon', 'beef_mince', 'butter', 'cheese', 'chicken_breast', 'chicken_thigh',
  'egg', 'milk', 'pork', 'prawn', 'salmon', 'sausage', 'yoghurt',
]
const EXCLUDED_LABELS = {
  Vegan: ANIMAL_PRODUCTS,
  'Gluten-free': ['bread', 'pasta', 'flour', 'noodles', 'tortilla'],
  'Dairy-free': ['milk', 'cheese', 'butter', 'yoghurt'],
  'No shellfish': ['prawn'],
  'No nuts': ['peanut_butter'],
  'No eggs': ['egg'],
  'No soy': ['tofu', 'soy_sauce'],
  'No milk': ['milk', 'cheese', 'butter', 'yoghurt'],
  'No wheat': ['bread', 'pasta', 'flour', 'noodles', 'tortilla'],
  'No sesame': [],
  'No fish': ['salmon'],
  'No lupin': [],
  'No sulphites': [],
}

/**
 * Health goals nudge the order rather than removing recipes. A goal should not
 * hide food the user can actually cook tonight.
 */
const GOAL_PREFERRED_TAG = {
  'Weight loss': 'low-calorie',
  'Muscle gain': 'high-protein',
}
const GOAL_BOOST = 0.15

const MEAL_EMOJI = {
  breakfast: '🍳', lunch: '🥪', dinner: '🍽️', snack: '🍎', side: '🥗',
}

const INGREDIENT_EMOJI = {
  apple: '🍎', avocado: '🥑', bacon: '🥓', banana: '🍌', beef_mince: '🥩',
  bread: '🍞', broccoli: '🥦', butter: '🧈', capsicum: '🫑', carrot: '🥕',
  cheese: '🧀', chicken_breast: '🍗', chicken_thigh: '🍗', corn: '🌽',
  cucumber: '🥒', egg: '🥚', garlic: '🧄', grape: '🍇', lemon: '🍋',
  lettuce: '🥬', mango: '🥭', milk: '🥛', mushroom: '🍄', onion: '🧅',
  orange: '🍊', pasta: '🍝', pork: '🥩', potato: '🥔', prawn: '🍤',
  pumpkin: '🎃', rice: '🍚', salmon: '🐟', sausage: '🌭', spinach: '🥬',
  strawberry: '🍓', tofu: '🧊', tomato: '🍅', yoghurt: '🥣', zucchini: '🥒',
  oats: '🥣', flour: '🌾', noodles: '🍜', tortilla: '🌯',
  canned_tomatoes: '🥫', coconut_milk: '🥥', soy_sauce: '🍶',
  olive_oil: '🫒', pasta_sauce: '🥫', peanut_butter: '🥜',
}

export const emojiForIngredient = (label) => INGREDIENT_EMOJI[String(label).toLowerCase()] || '🥗'
export const emojiForRecipe = (recipe) => MEAL_EMOJI[recipe?.meal_type] || '🍽️'

/** "canned_tomatoes" → "Canned tomatoes" */
export function displayName(label) {
  const words = String(label).replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * How much of a recipe the user already has.
 * `matchPercent` is purely coverage, so it stays truthful regardless of how
 * the list is later sorted.
 */
export function scoreRecipe(recipe, ingredients) {
  const have = new Set(ingredients.map((i) => String(i.label).toLowerCase()))
  const hit = recipe.ingredients.filter((n) => have.has(n))
  const missing = recipe.ingredients.filter((n) => !have.has(n))
  return {
    hit,
    missing,
    matchPercent: Math.round((hit.length / recipe.ingredients.length) * 100),
  }
}

/**
 * Split the recipe list by the user's hard preferences.
 * Returns the recipes that survive plus the reasons others were removed, so
 * the UI can explain an empty result instead of just showing nothing.
 */
export function applyPreferences(recipes, preferences = {}) {
  const selected = [...(preferences.diets || []), ...(preferences.allergies || [])]
  const reasons = new Map()
  if (!selected.length) return { kept: recipes, reasons }

  const kept = recipes.filter((recipe) => {
    for (const pref of selected) {
      const tag = REQUIRED_TAG[pref]
      if (tag && !recipe.dietary_tags.includes(tag)) {
        reasons.set(pref, (reasons.get(pref) || 0) + 1)
        return false
      }
      const banned = EXCLUDED_LABELS[pref]
      if (banned && recipe.ingredients.some((i) => banned.includes(i))) {
        reasons.set(pref, (reasons.get(pref) || 0) + 1)
        return false
      }
    }
    return true
  })
  return { kept, reasons }
}

/**
 * Rank recipes for the ingredients the user confirmed.
 * Sort order blends coverage with any health-goal boost; the displayed
 * `matchPercent` is left untouched so it never reads above 100.
 */
export function rankRecipes(recipes, ingredients, preferences = {}) {
  const { kept, reasons } = applyPreferences(recipes, preferences)
  const goals = preferences.goals || []
  const preferredTags = goals.map((g) => GOAL_PREFERRED_TAG[g]).filter(Boolean)

  const ranked = kept
    .map((recipe) => {
      const scored = scoreRecipe(recipe, ingredients)
      const boost = preferredTags.some((t) => recipe.dietary_tags.includes(t)) ? GOAL_BOOST : 0
      return { ...recipe, ...scored, sortKey: scored.matchPercent / 100 + boost }
    })
    .filter((r) => r.hit.length > 0)
    .sort((a, b) =>
      b.sortKey - a.sortKey ||
      a.missing.length - b.missing.length ||
      a.recipe_name.localeCompare(b.recipe_name))

  return { ranked, excludedBy: reasons, consideredCount: kept.length }
}

/**
 * Build supermarket search links from the rules in
 * missing-ingredient-links-v1.json: underscores to spaces, trim, URL encode.
 */
export function storeLinks(label, providers) {
  if (!providers) return []
  const query = String(label).replace(/_/g, ' ').trim()
  return Object.entries(providers).map(([key, provider]) => ({
    key,
    name: provider.name,
    url: provider.search_url_template.replace('{query}', encodeURIComponent(query)),
  }))
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

let dataPromise
/** Fetch and memoise the whole food data layer. */
export function loadFoodData() {
  if (!dataPromise) {
    dataPromise = Promise.all([
      fetchJson(RECIPES_URL),
      fetchJson(NUTRITION_URL),
      fetchJson(LINKS_URL),
      fetchJson(ATTRIBUTION_URL),
    ])
      .then(([recipeFile, nutritionFile, linksFile, attribution]) => ({
        recipes: recipeFile.recipes,
        recipesById: new Map(recipeFile.recipes.map((r) => [r.recipe_id, r])),
        nutritionByLabel: new Map(nutritionFile.items.map((i) => [i.label, i])),
        nutritionBasis: nutritionFile.unit_basis,
        providers: linksFile.providers,
        attribution,
      }))
      .catch((err) => { dataPromise = undefined; throw err })
  }
  return dataPromise
}

/** React binding for the memoised loader. */
export function useFoodData() {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  useEffect(() => {
    let cancelled = false
    loadFoodData()
      .then((data) => { if (!cancelled) setState({ data, error: null, loading: false }) })
      .catch((error) => { if (!cancelled) setState({ data: null, error, loading: false }) })
    return () => { cancelled = true }
  }, [])
  return state
}
