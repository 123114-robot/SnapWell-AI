# SnapWell AI API Version v1

This folder defines the API-based recommendation version for SnapWell AI.

In this version, recipes are generated dynamically by AI instead of being selected from a fixed local recipe dataset. AUSNUT remains the structured data source for ingredient mapping and nutrition calculation.

## Files

| File | Description |
|---|---|
| `ai-input-schema-v1.json` | Example input structure for the AI recommendation request. |
| `ai-output-schema-v1.json` | Example output structure for the AI recommendation response. |
| `ai-recommendation-prompt-v1.md` | Prompt rules for AI-generated recipe recommendations. |

## Input

The input schema includes:

- confirmed ingredients
- ingredient quantities
- AUSNUT public food keys
- AUSNUT food names
- nutrition values from AUSNUT
- nutrition summary
- user preferences
- allergens
- health goal
- meal type
- cuisine preference
- missing ingredient link templates
- generation constraints

## Output

The output schema includes:

- recipe ID
- recipe name
- meal type
- cuisine style
- used ingredients
- missing ingredients
- missing ingredient shopping links
- cooking steps
- dietary tags
- nutrition note
- recommendation reason
- response summary
