/**
 * Where in the flow the assistant is, and what it can stand on there.
 *
 * Each stage has its own grounding. On the home screen the assistant works
 * from the SnapWell app guide; on the ingredient screens from the user's list
 * and the recipe book; on the recipe screens from the ranked list the user is
 * looking at. A screen with none of these — the camera, a product page — gets
 * no assistant, because an assistant with nothing to stand on is a general
 * chatbot.
 *
 * Pages sit one level below stages. They share their stage's grounding and
 * tools, and differ only in what a user there is likely to want to ask.
 */
export const CHAT_STAGES = Object.freeze({
  HOME: 'home',
  INGREDIENTS: 'ingredients',
  RECIPES: 'recipes',
})

export const CHAT_PAGES = Object.freeze({
  HOME: 'home',
  INGREDIENTS: 'ingredients',
  RECOMMENDATIONS: 'recommendations',
  RECIPE: 'recipe',
  NUTRITION: 'nutrition',
  MISSING: 'missing',
})

const PAGE_STAGES = Object.freeze({
  [CHAT_PAGES.HOME]: CHAT_STAGES.HOME,
  [CHAT_PAGES.INGREDIENTS]: CHAT_STAGES.INGREDIENTS,
  [CHAT_PAGES.RECOMMENDATIONS]: CHAT_STAGES.RECIPES,
  [CHAT_PAGES.RECIPE]: CHAT_STAGES.RECIPES,
  [CHAT_PAGES.NUTRITION]: CHAT_STAGES.RECIPES,
  [CHAT_PAGES.MISSING]: CHAT_STAGES.RECIPES,
})

export function chatPageFor(pathname) {
  const path = String(pathname ?? '')
  if (path === '/') return CHAT_PAGES.HOME
  if (path === '/confirm' || path === '/quantity') return CHAT_PAGES.INGREDIENTS
  if (path === '/recommendations') return CHAT_PAGES.RECOMMENDATIONS
  if (/^\/recipe\/.+/.test(path)) return CHAT_PAGES.RECIPE
  if (/^\/nutrition\/.+/.test(path)) return CHAT_PAGES.NUTRITION
  if (path === '/missing') return CHAT_PAGES.MISSING
  return null
}

export function chatStageFor(pathname) {
  const page = chatPageFor(pathname)
  return page ? PAGE_STAGES[page] : null
}

/** Whether the stage has anything to work from yet. */
export function stageReady(stage, { ingredients, recommendationResult } = {}) {
  const hasIngredients = Array.isArray(ingredients) && ingredients.length > 0
  // The app guide is always there, so the home screen needs nothing from the user
  if (stage === CHAT_STAGES.HOME) return true
  if (stage === CHAT_STAGES.INGREDIENTS) return hasIngredients
  if (stage === CHAT_STAGES.RECIPES) {
    return hasIngredients && (recommendationResult?.recommendations?.length ?? 0) > 0
  }
  return false
}

/** The recipe a recipe screen is about, when it is about one. */
export function focusedRecipeIdFor(pathname, selectedRecipe = null) {
  const path = String(pathname ?? '')
  const match = path.match(/^\/(?:recipe|nutrition)\/(.+)$/)
  if (match) {
    try {
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }
  if (path === '/missing' && selectedRecipe?.id != null) return String(selectedRecipe.id)
  return null
}

export const STAGE_COPY = Object.freeze({
  [CHAT_STAGES.HOME]: {
    label: 'using SnapWell',
    subtitle: 'Using the SnapWell app guide',
    intro: () => 'Ask me how SnapWell works — scanning, modes, recipes, nutrition or privacy.',
    placeholder: 'Ask about SnapWell…',
  },
  [CHAT_STAGES.INGREDIENTS]: {
    label: 'your ingredients',
    subtitle: 'Using your ingredient list and the SnapWell recipe book',
    intro: count => `Ask about the ${count} ingredient${count === 1 ? '' : 's'} on your list. `
      + 'The assistant answers from SnapWell\'s recipe book and nutrition data.',
    placeholder: 'Ask about your ingredients…',
  },
  [CHAT_STAGES.RECIPES]: {
    label: 'your recipes',
    subtitle: 'Using the recipes on your list',
    intro: count => `Ask about the ${count} recipe${count === 1 ? '' : 's'} on your list.`,
    placeholder: 'Ask about these recipes…',
  },
})

/**
 * Starter questions for each page. The conversation carries across screens, so
 * an empty chat is not the only place a user needs a nudge: these sit above the
 * input on every screen, and name the recipe on screens that are about one.
 */
const PAGE_SUGGESTIONS = Object.freeze({
  [CHAT_PAGES.HOME]: () => [
    'How does SnapWell work?',
    'What\'s the difference between Local and Online mode?',
    'What data leaves my phone?',
    'How do I get recipe suggestions?',
  ],
  [CHAT_PAGES.INGREDIENTS]: () => [
    'What can I cook with these?',
    'Which one ingredient would unlock the most recipes?',
    'How many calories are in my list?',
  ],
  [CHAT_PAGES.RECOMMENDATIONS]: () => [
    'Which recipe needs the fewest extra ingredients?',
    'What can I cook without shopping?',
    'Which one is highest in protein?',
  ],
  [CHAT_PAGES.RECIPE]: name => [
    `How do I make ${name}?`,
    `Why was ${name} suggested?`,
    `Is ${name} OK for my allergies?`,
  ],
  [CHAT_PAGES.NUTRITION]: name => [
    `How much protein is in ${name} per serving?`,
    'Is the nutrition data complete?',
  ],
  [CHAT_PAGES.MISSING]: name => [
    `What is ${name} still missing?`,
    'Is there a similar recipe I can make without shopping?',
  ],
})

export function suggestionsFor(page, recipeName = null) {
  const name = String(recipeName ?? '').trim() || 'this recipe'
  return PAGE_SUGGESTIONS[page]?.(name) ?? []
}

const APP_HELP_TOOL = '- get_app_help: the SnapWell app guide, for any question about how the app itself works'

/** The part of the system instruction that changes with the stage. */
export const STAGE_PROMPTS = Object.freeze({
  [CHAT_STAGES.HOME]: `## Where the user is

The user is on the SnapWell home screen and may be new to the app. There is no recipe list here, so candidate_recipes is empty.

Tools for this stage:
- get_app_help: the SnapWell app guide — how the app works, its screens, Local and Online mode, privacy, recipes, nutrition, settings, barcode scanning and this assistant

When the user asks how to do something, answer in a few friendly sentences that name the screen or button to use.`,
  [CHAT_STAGES.INGREDIENTS]: `## Where the user is

The user is still building their ingredient list. There is no ranked recipe list yet, so candidate_recipes is empty.

Tools for this stage:
- preview_recipes: rank the SnapWell recipe book against the current list, the same way the app will
- suggest_additions: which single ingredient, added to the list, would bring the most recipes up to a strong match
- get_list_nutrition: total nutrition for the list at the quantities entered, from AUSNUT reference data
- check_ingredient: check an ingredient against the user's allergens and diet
${APP_HELP_TOOL}

Recipes at this stage come only from the SnapWell recipe book.`,
  [CHAT_STAGES.RECIPES]: `## Where the user is

The user is looking at their ranked recipe list, or at one recipe from it. candidate_recipes summarises the top of that list.

Tools for this stage:
- find_recipes: search the whole of the user's list, not only the summary
- get_recipe_details: ingredients, steps and missing ingredients for one recipe
- get_recipe_nutrition: per-serving nutrition calculated from AUSNUT reference data
- check_ingredient: check an ingredient against the user's allergens and diet
${APP_HELP_TOOL}`,
})
