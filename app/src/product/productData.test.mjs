import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  addOcrEvidence, assessProductSafety, dietaryStatus, normaliseBarcode,
  normaliseProduct, isPlaceholderBarcode, parseAllergenStatements, parseNutritionPanel,
} from './productData.js'

test('validates common retail barcodes', () => {
  assert.equal(normaliseBarcode('3017620422003'), '3017620422003')
  assert.equal(normaliseBarcode('3017 6204 2200 3'), '3017620422003')
  assert.equal(normaliseBarcode('3017620422004'), '')
  assert.equal(normaliseBarcode('abc'), '')
  assert.equal(isPlaceholderBarcode('9312345678907'), true)
  assert.equal(isPlaceholderBarcode('9310052122539'), false)
})

test('only confirms gluten-free and dairy-free with positive evidence', () => {
  const labelled = normaliseProduct({
    labels_tags: ['en:gluten-free', 'en:dairy-free'], nutriments: {},
  })
  assert.equal(dietaryStatus(labelled, 'gluten-free'), 'yes')
  assert.equal(dietaryStatus(labelled, 'dairy-free'), 'yes')

  const contains = normaliseProduct({
    allergens_tags: ['en:wheat', 'en:milk'], nutriments: {},
  })
  assert.equal(dietaryStatus(contains, 'gluten-free'), 'no')
  assert.equal(dietaryStatus(contains, 'dairy-free'), 'no')

  const incomplete = normaliseProduct({ nutriments: {} })
  assert.equal(dietaryStatus(incomplete, 'gluten-free'), 'unknown')
  assert.equal(dietaryStatus(incomplete, 'dairy-free'), 'unknown')
})

const fixture = (name) => readFileSync(
  new URL(`../ai/fixtures/labels/${name}`, import.meta.url), 'utf8',
)

/**
 * Ground truth is the per-100 g column of the photographed jar, transcribed by
 * hand. Every value here was previously wrong by a factor of ten or more,
 * because the recognised text loses the decimal point in that column
 * ("1.5g" -> "159", "4.9g" -> "45g") and the parser took it at face value.
 */
test('reads a real photographed panel using the label own %DI column', () => {
  const parsed = parseNutritionPanel(
    fixture('pasta-sauce-nutrition-panel.single-block.txt'),
  )
  assert.equal(parsed.servingSizeG, 125)
  assert.equal(parsed.energyKj, 168)
  assert.equal(parsed.proteinG, 1.5)
  assert.equal(parsed.carbohydrateG, 6)
  assert.equal(Number(parsed.sugarsG.toFixed(1)), 4.9)
  assert.equal(parsed.fibreG, 1.3)
  assert.equal(parsed.sodiumMg, 284)
  // "< 1.0g" must stay a bound, not become a flat 1 g.
  assert.equal(parsed.fatG, 1)
  assert.equal(parsed.lessThan.fatG, true)
  assert.equal(parsed.lessThan.saturatedFatG, true)
  // Seven of the eight rows were corroborated against the printed percentages.
  assert.ok(parsed.confirmedRows >= 7)
})

/**
 * What the running app actually assembles: the sparse locate pass over the
 * downscaled copy, then the preprocessed single-block re-read, concatenated.
 * Both halves mention every nutrient, and the sparse half carries no usable
 * numbers, so a parser that stops at the first line naming a nutrient reads
 * the wrong one. Preprocessing also damages the digits differently from raw
 * recognition, which is why this is pinned separately.
 */
test('reads the text the running scan pipeline actually produces', () => {
  const parsed = parseNutritionPanel(
    fixture('pasta-sauce-nutrition-panel.app-pipeline.txt'),
  )
  assert.equal(parsed.energyKj, 168)
  assert.equal(parsed.proteinG, 1.5)
  assert.equal(parsed.carbohydrateG, 6)
  assert.equal(Number(parsed.sugarsG.toFixed(1)), 4.9)
  assert.equal(parsed.fibreG, 1.3)
  assert.equal(parsed.sodiumMg, 284)
  // Both fat rows print "<1.0g"; recognised as "<10g" they must not become 10.
  assert.equal(parsed.fatG, 1)
  assert.equal(parsed.saturatedFatG, 1)
  assert.equal(parsed.lessThan.fatG, true)
  assert.equal(parsed.lessThan.saturatedFatG, true)
})

/**
 * Sparse page segmentation emits one table cell per line in column order, so
 * a row no longer holds its own values. Returning nothing is correct; the old
 * parser returned another nutrient's cell (sodium 15 mg for a 284 mg label).
 */
test('refuses a nutrition panel whose rows have been shredded', () => {
  assert.equal(
    parseNutritionPanel(fixture('pasta-sauce-nutrition-panel.sparse-text.txt')),
    null,
  )
})

/**
 * A panel prints energy twice, as kilojoules and as "(40Cal)" beside it. The
 * old parser took the last number on the line and reported 40 kJ for a 168 kJ
 * food, because "Cal" was not among the units it recognised.
 */
test('does not read the kilocalorie figure as kilojoules', () => {
  const parsed = parseNutritionPanel(`
    NUTRITION INFORMATION
    Serving Size: 125g
    Energy 209kJ (50Cal) 2% 168kJ (40Cal)
    Protein 1.9g 4% 1.5g
    Fat, Total 1.0g 1% 1.0g
    Sodium 355mg 15% 284mg
  `)
  // 40 Cal is 167.4 kJ, which the label rounds to 168; either is a correct
  // read of this row, and the raw 40 is not.
  assert.ok(Math.abs(parsed.energyKj - 168) < 1, `got ${parsed.energyKj}`)
})

/**
 * The per-100 g wording is set in the column header, which is printed across
 * two lines and is often the first thing a photograph loses. It used to gate
 * the whole panel, so one missing phrase reported every nutrient as unknown.
 */
test('still parses when the per-100 g column header is lost', () => {
  const parsed = parseNutritionPanel(`
    NUTRITION INFORMATION
    Serving Size: 125g
    Energy 209kJ 2% 168kJ
    Protein 1.9g 4% 1.5g
    Carbohydrate 7.5g 2% 6.0g
    Sodium 355mg 15% 284mg
  `)
  assert.equal(parsed.energyKj, 168)
  assert.equal(parsed.proteinG, 1.5)
  assert.equal(parsed.sodiumMg, 284)
})

test('parses per-100 g nutrition only when the panel header is present', () => {
  const parsed = parseNutritionPanel(`
    NUTRITION INFORMATION Serving size 100g
    Average Quantity per Serving Average Quantity per 100g
    Energy 565kJ 565kJ
    Protein 21.4g 21.4g
    Fat, total 5.0g 5.0g
    Sugars less than 1g less than 1g
    Dietary fibre 0g 0g
    Sodium 58mg 58mg
  `)
  assert.equal(parsed.energyKj, 565)
  assert.equal(parsed.proteinG, 21.4)
  assert.equal(parsed.fatG, 5)
  assert.equal(parsed.sugarsG, 1)
  assert.equal(parsed.fibreG, 0)
  assert.equal(parsed.sodiumMg, 58)
  assert.equal(parseNutritionPanel('Energy 565kJ Protein 21.4g'), null)
})

test('normalises Open Food Facts nutrition and tags', () => {
  const product = normaliseProduct({
    code: '3017620422003', product_name: 'Test spread', allergens_tags: ['en:milk'],
    traces_tags: [], ingredients_text: 'Sugar, milk',
    nutriments: {
      'energy-kj_100g': 1200, fat_100g: 18, sugars_100g: 20,
      sodium_100g: 0.4, 'saturated-fat_100g': 3,
    },
  })
  assert.deepEqual(product.allergens, ['milk'])
  assert.equal(product.nutritionPer100g.energyKj, 1200)
  assert.equal(product.nutritionPer100g.fatG, 18)
  assert.equal(product.nutritionPer100g.sodiumMg, 400)
  assert.equal(product.completeness.nutrition, true)
})

test('extracts only explicit contains and may-contain statements', () => {
  assert.deepEqual(
    parseAllergenStatements('CONTAINS: MILK, SOY. MAY CONTAIN PEANUTS AND SESAME.'),
    { contains: ['milk', 'soybeans'], traces: ['peanuts', 'sesame-seeds'] },
  )
})

test('uses four-state allergen assessment', () => {
  const base = normaliseProduct({
    code: '3017620422003', allergens_tags: ['en:milk'], traces_tags: [],
    ingredients_text: 'Milk', nutriments: {},
  })
  const withOcr = addOcrEvidence(base, 'MAY CONTAIN PEANUTS')
  const result = assessProductSafety(withOcr, {
    allergies: ['No nuts', 'No eggs'],
  })
  assert.equal(result[0].status, 'trace')
  assert.equal(result[1].status, 'clear')

  const incomplete = normaliseProduct({ code: '3017620422003', nutriments: {} })
  assert.equal(
    assessProductSafety(incomplete, { allergies: ['No soy'] })[0].status,
    'unknown',
  )

  const coconut = normaliseProduct({
    code: '3017620422003', allergens_tags: ['en:coconuts'], traces_tags: [],
    ingredients_text: 'Coconut', nutriments: {},
  })
  assert.equal(
    assessProductSafety(coconut, { allergies: ['No nuts'] })[0].status,
    'clear',
  )
})

test('assesses the expanded common allergen preferences', () => {
  const product = normaliseProduct({
    allergens_tags: ['en:milk', 'en:wheat', 'en:sesame-seeds', 'en:fish', 'en:lupin'],
    traces_tags: ['en:sulphur-dioxide-and-sulphites'],
    ingredients_text: 'Milk, wheat, sesame, fish, lupin',
    nutriments: {},
  })
  const result = assessProductSafety(product, {
    allergies: ['No milk', 'No wheat', 'No sesame', 'No fish', 'No lupin', 'No sulphites'],
  })
  assert.deepEqual(result.map((item) => item.status), [
    'conflict', 'conflict', 'conflict', 'conflict', 'conflict', 'trace',
  ])
})
