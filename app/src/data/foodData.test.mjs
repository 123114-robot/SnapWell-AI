/**
 * Zero-dependency tests for the food data layer.
 *
 *   node src/data/foodData.test.mjs
 *
 * Covers both the pure ranking/filtering functions and the integrity of the
 * dataset they read, since a wrong dietary tag would silently recommend meat
 * to a vegetarian.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  applyPreferences, displayName, rankRecipes, scoreRecipe, storeLinks,
} from './foodData.js'

const read = (name) => JSON.parse(
  readFileSync(fileURLToPath(new URL(`../../public/data/food_data/${name}`, import.meta.url)), 'utf8'),
)

const recipes = read('recipes-v1.json').recipes
const nutrition = read('ingredient-nutrition-v1.json')
const links = read('missing-ingredient-links-v1.json')
const attribution = read('attribution-v1.json')

const nutritionByLabel = new Map(nutrition.items.map((i) => [i.label, i]))
const have = (...labels) => labels.map((label, id) => ({ id, label }))

let passed = 0
const failures = []
function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed += 1
  else failures.push({ name, expected, actual })
}

// ------------------------------------------------------------ dataset integrity

check('all 100 recipes are loaded', recipes.length, 100)

check('every recipe ingredient has AUSNUT nutrition',
  recipes.flatMap((r) => r.ingredients).filter((i) => !nutritionByLabel.has(i)), [])

check('every recipe has at least one step',
  recipes.filter((r) => !r.steps || !r.steps.length).map((r) => r.recipe_id), [])

// A wrong tag here would recommend meat to a vegetarian, so verify the data
// rather than trusting it.
const MEAT = ['bacon', 'beef_mince', 'chicken_breast', 'chicken_thigh', 'pork', 'prawn', 'salmon', 'sausage']
check('no recipe tagged vegetarian contains meat or seafood',
  recipes
    .filter((r) => r.dietary_tags.includes('vegetarian'))
    .filter((r) => r.ingredients.some((i) => MEAT.includes(i)))
    .map((r) => r.recipe_id),
  [])

check('nutrition is stated per 100 g', nutrition.unit_basis, 'per 100g edible portion')
check('attribution names the dataset actually used', attribution.dataset, 'AUSNUT 2023')

// The dataset carries no quantities, so the UI must never sum a recipe total.
check('recipes carry no quantity field',
  Object.keys(recipes[0]).filter((k) => /quantity|gram|serve|kcal|time/.test(k)), [])

// ---------------------------------------------------------------------- scoring

const eggToast = recipes.find((r) => r.recipe_id === 'R001')  // avocado, bread, egg, tomato
check('coverage counts what the user has',
  scoreRecipe(eggToast, have('avocado', 'bread')).matchPercent, 50)
check('missing list is the remainder',
  scoreRecipe(eggToast, have('avocado', 'bread')).missing.sort(), ['egg', 'tomato'])
check('a full match is 100',
  scoreRecipe(eggToast, have('avocado', 'bread', 'egg', 'tomato')).matchPercent, 100)
check('extra ingredients never push coverage above 100',
  scoreRecipe(eggToast, have('avocado', 'bread', 'egg', 'tomato', 'rice')).matchPercent, 100)

// ------------------------------------------------------------------ preferences

check('no preferences keeps every recipe',
  applyPreferences(recipes, {}).kept.length, recipes.length)

const vego = applyPreferences(recipes, { diets: ['Vegetarian'] }).kept
check('vegetarian keeps only tagged recipes',
  vego.every((r) => r.dietary_tags.includes('vegetarian')), true)

const vegan = applyPreferences(recipes, { diets: ['Vegan'] }).kept
check('vegan excludes every animal product',
  vegan.filter((r) => r.ingredients.some((i) =>
    ['milk', 'egg', 'cheese', 'butter', 'yoghurt', ...MEAT].includes(i))).length, 0)

const glutenFree = applyPreferences(recipes, { diets: ['Gluten-free'] }).kept
check('gluten-free excludes wheat staples',
  glutenFree.filter((r) => r.ingredients.some((i) =>
    ['bread', 'pasta', 'flour', 'noodles', 'tortilla'].includes(i))).length, 0)

const noEggs = applyPreferences(recipes, { allergies: ['No eggs'] }).kept
check('an allergy removes every recipe using it',
  noEggs.filter((r) => r.ingredients.includes('egg')).length, 0)

check('preferences combine as AND, never widening the result',
  applyPreferences(recipes, { diets: ['Vegan', 'Gluten-free'] }).kept.length <= vegan.length, true)

check('an empty result reports which preference caused it',
  applyPreferences(recipes, { allergies: ['No eggs'] }).reasons.get('No eggs') > 0, true)

// --------------------------------------------------------------------- ranking

const ranked = rankRecipes(recipes, have('avocado', 'bread', 'egg', 'tomato'), {}).ranked
check('ranking returns something for a common pantry', ranked.length > 0, true)
check('recipes sharing nothing with the user are dropped',
  ranked.every((r) => r.hit.length > 0), true)
check('best coverage comes first',
  ranked[0].matchPercent >= ranked[ranked.length - 1].matchPercent, true)
check('displayed coverage never exceeds 100',
  ranked.every((r) => r.matchPercent <= 100), true)

// A goal reorders but must not remove anything.
const plain = rankRecipes(recipes, have('egg', 'bread', 'tomato', 'cheese'), {})
const withGoal = rankRecipes(recipes, have('egg', 'bread', 'tomato', 'cheese'), { goals: ['Muscle gain'] })
check('a health goal reorders without dropping recipes',
  withGoal.ranked.length, plain.ranked.length)
// The goal is a nudge, not an override: a recipe the user can make in full
// still outranks one they cannot. What must improve is the average position
// of the recipes the goal favours.
const averagePosition = (list) => {
  const positions = list.reduce((acc, r, i) =>
    (r.dietary_tags.includes('high-protein') ? [...acc, i] : acc), [])
  return positions.reduce((sum, i) => sum + i, 0) / positions.length
}
check('a health goal moves the recipes it favours further up the list',
  averagePosition(withGoal.ranked) < averagePosition(plain.ranked), true)

check('a fully makeable recipe still outranks a goal-boosted partial one',
  withGoal.ranked[0].matchPercent, 100)

// ----------------------------------------------------------------- store links

const built = storeLinks('coconut_milk', links.providers)
check('one link per configured provider', built.map((l) => l.key).sort(), ['coles', 'woolworths'])
check('underscores become spaces and the query is encoded',
  built.find((l) => l.key === 'coles').url,
  'https://www.coles.com.au/search/products?q=coconut%20milk')
check('the woolworths link follows its own template',
  built.find((l) => l.key === 'woolworths').url,
  'https://www.woolworths.com.au/shop/search/products?searchTerm=coconut%20milk')
check('links match the documented example exactly',
  built.find((l) => l.key === 'coles').url, links.rule.example.coles_url)

// -------------------------------------------------------------------- display

check('underscored labels render as words', displayName('canned_tomatoes'), 'Canned tomatoes')

// ------------------------------------------------------------------- reporting

const total = passed + failures.length
for (const f of failures) {
  console.error(`FAIL  ${f.name}`)
  console.error(`      expected ${JSON.stringify(f.expected)}`)
  console.error(`      actual   ${JSON.stringify(f.actual)}`)
}
console.log(`${passed}/${total} passed`)
process.exit(failures.length ? 1 : 0)
