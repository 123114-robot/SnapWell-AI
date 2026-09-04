import { displayIngredientLabel } from './recommendationAdapter.js'
import { convertQuantityToGrams } from './nutritionService.js'

export const GEMINI_MODEL = 'gemini-3.5-flash-lite'
export const DEFAULT_ONLINE_TIMEOUT_MS = 60000
export const ONLINE_SERVICE_ERROR_MESSAGE = 'Unable to connect to online service.'

const DEFAULT_LINK_TEMPLATES = Object.freeze({
  coles: 'https://www.coles.com.au/search/products?q={query}',
  woolworths: 'https://www.woolworths.com.au/shop/search/products?searchTerm={query}',
})

const SYSTEM_INSTRUCTION = `You are the recipe recommendation assistant for SnapWell AI.

Your task is to generate recipe recommendations based on confirmed ingredients, user preferences, and AUSNUT-based nutrition information provided by the app.

## Input

You will receive JSON input containing:

- confirmed ingredients
- ingredient quantities in grams
- AUSNUT public food keys
- AUSNUT food names
- nutrition values calculated by the app
- user dietary preferences
- user allergens
- user health goal
- preferred meal type
- preferred cuisine style
- missing ingredient link templates

## Rules

1. Use the confirmed ingredients as the primary basis for recipe recommendations.
2. You may suggest a small number of missing ingredients only if allowed by \`max_missing_ingredients\`.
3. Do not invent nutrition values.
4. If nutrition information is needed, refer only to the nutrition values provided in the input.
5. Do not recommend ingredients that conflict with the user's allergens or dietary pattern.
6. Keep the recipes realistic for Australian users.
7. Prefer common Australian supermarket ingredients.
8. If a missing ingredient is suggested, include Coles and Woolworths search links using the provided templates.
9. Return JSON only.
10. Follow the output schema exactly.

## Output Format

Return an object with this structure:

\`\`\`json
{
  "recommendations": [
    {
      "recipe_id": "AI001",
      "recipe_name": "Recipe name",
      "meal_type": "breakfast/lunch/dinner/snack/side",
      "cuisine_style": "Australian everyday",
      "used_ingredients": ["ingredient_label"],
      "missing_ingredients": [
        {
          "label": "ingredient_label",
          "display_name": "Ingredient Display Name",
          "optional": true,
          "reason": "Why this missing ingredient is useful.",
          "shopping_links": {
            "coles": "https://www.coles.com.au/search/products?q=ingredient",
            "woolworths": "https://www.woolworths.com.au/shop/search/products?searchTerm=ingredient"
          }
        }
      ],
      "steps": [
        "Step 1",
        "Step 2",
        "Step 3"
      ],
      "dietary_tags": ["tag"],
      "nutrition_note": "Nutrition values should be calculated by the app from AUSNUT data.",
      "recommendation_reason": "Short explanation of why this recipe matches the user input."
    }
  ],
  "summary": {
    "total_recommendations": 3,
    "assumptions": []
  }
}
\`\`\`

## Recommendation Behaviour

Generate 3 recipe recommendations unless the input requests a different number.

The recommendations should balance:

- ingredient overlap
- user preference fit
- health goal alignment
- practicality
- Australian localisation

Do not include long explanations outside the JSON.`

export function getApiKey(customKey = null) {
  if (customKey && typeof customKey === 'string' && customKey.trim()) {
    return customKey.trim()
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      return String(import.meta.env.VITE_GEMINI_API_KEY).trim()
    }
  } catch {
    // Non-Vite environment
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_GEMINI_API_KEY) return String(process.env.VITE_GEMINI_API_KEY).trim()
      if (process.env.GEMINI_API_KEY) return String(process.env.GEMINI_API_KEY).trim()
    }
  } catch {
    // Non-Node environment
  }
  try {
    if (typeof window !== 'undefined') {
      if (window.VITE_GEMINI_API_KEY) return String(window.VITE_GEMINI_API_KEY).trim()
      if (window.GEMINI_API_KEY) return String(window.GEMINI_API_KEY).trim()
      const localKey = window.localStorage?.getItem('VITE_GEMINI_API_KEY') || window.localStorage?.getItem('GEMINI_API_KEY')
      if (localKey) return String(localKey).trim()
    }
  } catch {
    // Non-browser environment
  }
  return null
}

export function buildAiInputPayload({
  ingredients = [],
  preferences = {},
  ingredientNutrition = {},
  ingredientPortions = null,
  linkData = null,
} = {}) {
  const items = Array.isArray(ingredientNutrition?.items) ? ingredientNutrition.items : []
  const itemMap = new Map(items.map(item => [item.label, item]))

  const confirmedIngredients = ingredients.map(ing => {
    const rawLabel = typeof ing === 'string' ? ing : ing?.label
    const label = String(rawLabel ?? '').trim().toLowerCase()
    const nutritionItem = itemMap.get(label)
    const displayName = displayIngredientLabel(label)
    const source = ing?.source || nutritionItem?.source || 'manual'

    let quantityG = 100
    if (ingredientPortions) {
      const conversion = convertQuantityToGrams(ing, ingredientPortions)
      if (conversion?.grams) quantityG = conversion.grams
    } else if (Number.isFinite(Number(ing?.quantity_g))) {
      quantityG = Number(ing.quantity_g)
    }

    const per100gKcal = Number(nutritionItem?.nutrition?.energy_kcal)
    const nutritionPer100g = Number.isFinite(per100gKcal)
      ? { energy_kcal: per100gKcal }
      : null

    const nutritionForQuantity = nutritionPer100g
      ? { energy_kcal: Math.round((per100gKcal * quantityG / 100) * 10) / 10 }
      : null

    return {
      label,
      display_name: displayName,
      source,
      ausnut_public_food_key: nutritionItem?.ausnut_public_food_key ?? null,
      ausnut_food_name: nutritionItem?.ausnut_food_name ?? null,
      quantity_g: quantityG,
      nutrition_per_100g: nutritionPer100g,
      nutrition_for_quantity: nutritionForQuantity,
    }
  })

  const totalKcal = confirmedIngredients.reduce((sum, ing) => {
    return sum + (ing.nutrition_for_quantity?.energy_kcal ?? 0)
  }, 0)

  const providers = linkData?.providers
  const linkTemplates = {
    coles: providers?.coles?.search_url_template ?? DEFAULT_LINK_TEMPLATES.coles,
    woolworths: providers?.woolworths?.search_url_template ?? DEFAULT_LINK_TEMPLATES.woolworths,
  }

  return {
    version: 'v1',
    description: 'Input schema for the AI-based recipe recommendation version of SnapWell AI.',
    input: {
      confirmed_ingredients: confirmedIngredients,
      nutrition_summary: {
        total_energy_kcal: Math.round(totalKcal * 10) / 10,
        ingredient_count: confirmedIngredients.length,
      },
      user_preferences: {
        dietary_pattern: preferences?.diets?.[0] ?? 'none',
        allergens: Array.isArray(preferences?.allergies) ? preferences.allergies : [],
        health_goal: preferences?.goals?.[0] ?? preferences?.healthGoal ?? 'balanced',
        meal_type: preferences?.mealType ?? 'any',
        cuisine_preference: preferences?.cuisinePreference ?? 'any',
        max_missing_ingredients: Number(preferences?.maxMissingIngredients) || 3,
      },
      missing_ingredient_link_templates: linkTemplates,
      constraints: {
        ai_generates_recipes: true,
        use_confirmed_ingredients_as_primary_inputs: true,
        do_not_invent_nutrition_values: true,
        return_json_only: true,
        australian_localisation: true,
      },
    },
  }
}

export async function generateOnlineRecommendations({
  inputPayload,
  apiKey = null,
  model = GEMINI_MODEL,
  timeoutMs = DEFAULT_ONLINE_TIMEOUT_MS,
  fetchFn = fetch,
} = {}) {
  const resolvedApiKey = getApiKey(apiKey)
  if (!resolvedApiKey) {
    return {
      success: false,
      error: ONLINE_SERVICE_ERROR_MESSAGE,
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(resolvedApiKey)}`

    const requestBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Generate recipe recommendations strictly matching the JSON input data:\n${JSON.stringify(inputPayload, null, 2)}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }

    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        success: false,
        error: ONLINE_SERVICE_ERROR_MESSAGE,
      }
    }

    const json = await response.json()
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) {
      return {
        success: false,
        error: ONLINE_SERVICE_ERROR_MESSAGE,
      }
    }
    
    const data = JSON.parse(rawText) || {}
if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).length === 0 ||
    !Array.isArray(data.recommendations)
  ) {      
  return {
        success: false,
        error: ONLINE_SERVICE_ERROR_MESSAGE,
      }
    }
    return {
      success: true,
      data,
    }
  } catch (err) {
    // console.error('Caught error during API execution:', err)
    return {
      success: false,
      error: ONLINE_SERVICE_ERROR_MESSAGE,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}