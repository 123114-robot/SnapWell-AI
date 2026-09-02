# SnapWell AI AUSNUT Data Layer v1

This folder contains the data layer for SnapWell AI. It connects detected ingredient labels to AUSNUT 2023 food IDs, nutrition values, recipe data, and missing-ingredient search rules.

## Contents

### Frontend-ready JSON files

| File | Purpose |
|---|---|
| `ingredient-map-v1.json` | Maps SnapWell ingredient labels to AUSNUT public food keys. |
| `nutrients-v1.json` | Contains nutrition values for the mapped AUSNUT foods. |
| `ingredient-nutrition-v1.json` | Combined ingredient mapping and nutrition data for Step 4. |
| `recipes-v1.json` | Australian-localised multicultural recipe dataset for recommendation logic. |
| `recipe-ingredient-map-v1.json` | Maps each recipe ingredient to an AUSNUT public food key. |
| `ingredient-portions-v1.json` | Standard unit-to-gram conversions for estimated nutrition. |
| `recipe-portions-v1.json` | Two-serving standard ingredient quantities for the 100 recipes. |
| `missing-ingredient-links-v1.json` | Rules for generating Coles and Woolworths search links for missing ingredients. |
| `attribution-v1.json` | AUSNUT source and CC BY attribution information. |

### Review CSV files

| File | Purpose |
|---|---|
| `vision-ingredient-map-v1.csv` | Human-readable mapping for visual detection labels. |
| `ocr-ingredient-map-v1.csv` | Human-readable mapping for OCR/package labels. |
| `nutrients-v1.csv` | Human-readable nutrition table for mapped AUSNUT foods. |
| `recipes-v1.csv` | Human-readable recipe dataset. |
| `recipe-ingredient-map-v1.csv` | Human-readable recipe ingredient to AUSNUT ID mapping. |

## Coverage

| Area | Count |
|---|---:|
| Vision ingredient labels | 39 |
| OCR/package ingredient labels | 10 |
| Total mapped ingredient labels | 49 |
| Recipe entries | 100 |
| Recipe ingredient references | 434 |

The recipe dataset uses all 49 mapped ingredient labels and contains no unmapped ingredient labels.

## Nutrition Estimates

Recipe nutrition is calculated from the standard quantities in `recipe-portions-v1.json`,
the unit conversions in `ingredient-portions-v1.json`, and the existing AUSNUT per-100g
values. Each ingredient nutrient is calculated as `per-100g value × grams / 100`, then
summed and divided by the recipe serving count.

The portion weights are prototype estimates rather than measured recipe specifications.
Actual values vary with ingredient size, brand, preparation method, and serving size.

## Data Sources

The food names, food classifications, measures, and nutrient values are derived from AUSNUT 2023, published by Food Standards Australia New Zealand.

The source files used for this data layer are:

| AUSNUT file | Usage |
|---|---|
| `AUSNUT 2023 - Food details.xlsx` | Food names, public food keys, food groups, and classifications. |
| `AUSNUT 2023 - Food nutrient profiles.xlsx` | Nutrient values for mapped foods. |
| `AUSNUT 2023 - List of nutrients.xlsx` | Nutrient metadata and units. |

## Ingredient Mapping

The ingredient labels come from two SnapWell channels:

| Source | Description |
|---|---|
| Vision detection | Labels from the app's visual ingredient detector. |
| OCR/package detection | Labels for packaged or pantry ingredients detected from product text. |

The mapping links each SnapWell label to one AUSNUT public food key. The selected AUSNUT item is intended to be a practical representative item for app-level nutrition calculation and recipe recommendation.

## Recipe Dataset

`recipes-v1.json` contains 100 Australian-localised recipe entries. The dataset is designed for Australian everyday use and includes multiple common local food patterns and cuisines:

- Australian cafe meals
- Australian everyday breakfasts, lunches, dinners, and snacks
- Italian-inspired pasta and bake dishes
- Asian-inspired rice, noodle, and stir-fry meals
- Thai-inspired coconut curry meals
- Indian-inspired curry-style meals
- Mediterranean-inspired salads and plates
- BBQ, roast, tray-bake, and side dishes

Each recipe includes:

| Field | Description |
|---|---|
| `recipe_id` | Stable recipe identifier. |
| `recipe_name` | Display name of the recipe. |
| `meal_type` | Breakfast, lunch, dinner, snack, or side. |
| `cuisine_style` | Broad cuisine or food pattern. |
| `ingredients` | SnapWell ingredient labels used by the recipe. |
| `steps` | Simple structured preparation steps. |
| `dietary_tags` | Tags such as vegetarian, high-protein, or low-calorie. |
| `missing_allowed` | Indicates whether the recipe can still be recommended with missing ingredients. |
| `notes` | Short internal note for review. |

## Data Structure

### `ingredient-nutrition-v1.json`

ingredient-level nutrition data.

Each item contains:

```json
{
  "label": "apple",
  "source": "vision",
  "ausnut_public_food_key": "F000114",
  "ausnut_food_name": "Apple, unpeeled, raw, not further defined",
  "match_type": "exact",
  "nutrition": {
    "energy_kcal_per_100g": 53.8
  }
}
```

### `recipes-v1.json`

recipe recommendation candidates

Each recipe contains:

```json
{
  "recipe_id": "R001",
  "recipe_name": "Avocado toast with egg",
  "meal_type": "breakfast",
  "cuisine_style": "Australian cafe",
  "ingredients": ["avocado", "bread", "egg", "tomato"],
  "steps": ["Toast bread", "Mash avocado", "Cook egg", "Serve with tomato"],
  "dietary_tags": ["vegetarian"],
  "missing_allowed": false,
  "notes": "Common Australian cafe breakfast"
}
```

### `recipe-ingredient-map-v1.json`

connect recipe ingredients to AUSNUT food IDs

Example item:

```json
{
  "ingredient_label": "avocado",
  "ausnut_public_food_key": "F000162",
  "ausnut_food_name": "Avocado, raw"
}
```

## How To Use This

For preference filtering, recipe matching, nutrition calculation, and missing-ingredient display, use:

```text
ingredient-nutrition-v1.json
recipes-v1.json
recipe-ingredient-map-v1.json
missing-ingredient-links-v1.json
```

Example nutrition calculation:

```js
const item = data.items.find((x) => x.label === 'apple')
const kcalFor150g = item.nutrition.energy_kcal_per_100g * 1.5
```

Example missing ingredient link generation:

```js
const query = missingLabel.replaceAll('_', ' ')
const colesUrl = `https://www.coles.com.au/search/products?q=${encodeURIComponent(query)}`
const woolworthsUrl = `https://www.woolworths.com.au/shop/search/products?searchTerm=${encodeURIComponent(query)}`
```

## Attribution

AUSNUT 2023 is provided by Food Standards Australia New Zealand under the Creative Commons Attribution 4.0 International licence.

Recommended attribution text:

```text
Food and nutrient data derived from AUSNUT 2023, Food Standards Australia New Zealand, licensed under CC BY 4.0.
```
