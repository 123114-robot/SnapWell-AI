// SnapWell v2 fine-tuned model — 39 classes, must match /models/classes.json
// and data/snapwell-v2/data.yaml exactly (alphabetical, underscore naming).
export const NAMES = [
  'apple', 'avocado', 'bacon', 'banana', 'beef_mince', 'bread', 'broccoli',
  'butter', 'capsicum', 'carrot', 'cheese', 'chicken_breast', 'chicken_thigh',
  'corn', 'cucumber', 'egg', 'garlic', 'grape', 'lemon', 'lettuce', 'mango',
  'milk', 'mushroom', 'onion', 'orange', 'pasta', 'pork', 'potato', 'prawn',
  'pumpkin', 'rice', 'salmon', 'sausage', 'spinach', 'strawberry', 'tofu',
  'tomato', 'yoghurt', 'zucchini'
]

// All 39 classes are ingredients now — no COCO non-food filtering needed.
export const FOOD_CLASSES = new Set(NAMES)
