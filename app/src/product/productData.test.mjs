import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  addOcrEvidence, assessProductSafety, dietaryStatus, normaliseBarcode,
  normaliseProduct, isPlaceholderBarcode, isRestrictedCirculationBarcode,
  lookupProduct, parseAllergenStatements, parseNutritionPanel,
  readCachedProduct, saveCachedProduct,
} from './productData.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

async function withProductGlobals({ fetchFn, now }, callback) {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const originalNow = Date.now
  globalThis.localStorage = memoryStorage()
  if (fetchFn) globalThis.fetch = fetchFn
  if (now != null) Date.now = () => now
  try {
    return await callback()
  } finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
    Date.now = originalNow
  }
}

test('validates common retail barcodes', () => {
  assert.equal(normaliseBarcode('3017620422003'), '3017620422003')
  assert.equal(normaliseBarcode('3017 6204 2200 3'), '3017620422003')
  assert.equal(normaliseBarcode('3017620422004'), '')
  assert.equal(normaliseBarcode('abc'), '')
  assert.equal(isPlaceholderBarcode('9312345678907'), true)
  assert.equal(isPlaceholderBarcode('9310052122539'), false)
})

// Codes decoded from the team's supermarket photos. The deli bacon label read
// 28140139, which Open Food Facts lists as an unrelated chai latte.
test('rejects store-assigned barcodes and keeps product barcodes', () => {
  assert.equal(isRestrictedCirculationBarcode('28140139'), true)
  assert.equal(isRestrictedCirculationBarcode('2212345678907'), true)
  assert.equal(isRestrictedCirculationBarcode('212345678909'), true)
  assert.equal(isRestrictedCirculationBarcode('512345678900'), true)
  // 500-509 is the United Kingdom, not a coupon range
  assert.equal(isRestrictedCirculationBarcode('5023456789010'), false)
  assert.equal(isRestrictedCirculationBarcode('9300462348575'), false)
  assert.equal(isRestrictedCirculationBarcode('9310645421957'), false)
  assert.equal(isRestrictedCirculationBarcode('81234561'), false)
  // UPC-E is also eight digits, but only ever starts with 0 or 1
  assert.equal(isRestrictedCirculationBarcode('01234565'), false)
  assert.equal(isRestrictedCirculationBarcode('not a barcode'), false)
})

// The record as Open Food Facts returned it for John West tuna, 9300462344690:
// no ingredients yet, yet both allergen arrays present and empty.
test('an empty allergen list without ingredients is not a declaration', () => {
  const tuna = normaliseProduct({
    code: '9300462344690', product_name: 'John west tuna',
    ingredients_text: '', allergens_tags: [], traces_tags: [],
    states_tags: ['en:to-be-completed', 'en:ingredients-to-be-completed'],
    nutriments: {},
  })
  assert.equal(assessProductSafety(tuna, { allergies: ['No fish'] })[0].status, 'unknown')

  const transcribed = normaliseProduct({
    code: '9300601173839', allergens_tags: [], traces_tags: [],
    ingredients_text: 'Tomato (99%), Basil, Oregano, Salt, Food Acid (Citric Acid).',
    nutriments: {},
  })
  assert.equal(assessProductSafety(transcribed, { allergies: ['No fish'] })[0].status, 'clear')

  const completedWithoutText = normaliseProduct({
    code: '9300601173839', allergens_tags: [], traces_tags: [],
    states_tags: ['en:ingredients-completed'], nutriments: {},
  })
  assert.equal(
    assessProductSafety(completedWithoutText, { allergies: ['No fish'] })[0].status, 'clear',
  )

  // A named allergen is evidence on its own, with or without ingredients
  const declaredOnly = normaliseProduct({
    code: '9310645181233', allergens_tags: ['en:soybeans'], traces_tags: [],
    ingredients_text: '', nutriments: {},
  })
  assert.equal(assessProductSafety(declaredOnly, { allergies: ['No soy'] })[0].status, 'conflict')
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

test('lookup rejects invalid and restricted barcodes before any network request', async () => {
  let fetchCalls = 0
  await withProductGlobals({ fetchFn: async () => { fetchCalls += 1 } }, async () => {
    await assert.rejects(() => lookupProduct('3017620422004'), /valid EAN or UPC/)
    await assert.rejects(() => lookupProduct('28140139'), /store label barcode/)
  })
  assert.equal(fetchCalls, 0)
})

test('lookup reports both HTTP and payload-level product-not-found responses', async () => {
  await withProductGlobals({
    fetchFn: async () => ({ status: 404, ok: false }),
  }, async () => {
    assert.deepEqual(await lookupProduct('3017620422003'), { product: null, cached: false })
  })

  await withProductGlobals({
    fetchFn: async () => ({ status: 200, ok: true, json: async () => ({ status: 0 }) }),
  }, async () => {
    assert.deepEqual(await lookupProduct('3017620422003'), { product: null, cached: false })
  })
})

test('lookup preserves incomplete Open Food Facts data as unknown, not safe', async () => {
  await withProductGlobals({
    fetchFn: async () => ({
      status: 200,
      ok: true,
      json: async () => ({ status: 1, product: { code: '3017620422003', nutriments: {} } }),
    }),
  }, async () => {
    const { product } = await lookupProduct('3017620422003')
    assert.equal(product.ingredientsText, '')
    assert.equal(product.completeness.ingredients, false)
    assert.equal(product.completeness.allergens, false)
    assert.equal(product.completeness.traces, false)
    assert.equal(assessProductSafety(product, { allergies: ['No nuts'] })[0].status, 'unknown')
  })
})

test('lookup surfaces API and network failures without treating them as not found', async () => {
  await withProductGlobals({
    fetchFn: async () => ({ status: 503, ok: false }),
  }, async () => {
    await assert.rejects(() => lookupProduct('3017620422003'), /Product lookup failed \(503\)/)
  })

  await withProductGlobals({
    fetchFn: async () => { throw new TypeError('network unavailable') },
  }, async () => {
    await assert.rejects(() => lookupProduct('3017620422003'), /network unavailable/)
  })
})

test('fresh cache entries bypass the API and expired entries are refreshed', async () => {
  const now = 2_000_000_000_000
  await withProductGlobals({ now }, async () => {
    const cachedProduct = normaliseProduct({
      code: '3017620422003', product_name: 'Cached product',
      ingredients_text: 'Cocoa', allergens_tags: [], traces_tags: [], nutriments: {},
    })
    saveCachedProduct(cachedProduct)
    let fetchCalls = 0
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error('should not fetch') }

    const fresh = await lookupProduct('3017620422003')
    assert.equal(fresh.cached, true)
    assert.equal(fresh.product.name, 'Cached product')
    assert.equal(fetchCalls, 0)

    Date.now = () => now + (8 * 24 * 60 * 60 * 1000)
    assert.equal(readCachedProduct('3017620422003'), null)
    globalThis.fetch = async () => ({ status: 404, ok: false })
    const expired = await lookupProduct('3017620422003')
    assert.deepEqual(expired, { product: null, cached: false })
  })
})

test('refresh bypasses an otherwise fresh cache entry', async () => {
  await withProductGlobals({}, async () => {
    saveCachedProduct(normaliseProduct({ code: '3017620422003', product_name: 'Old', nutriments: {} }))
    let fetchCalls = 0
    globalThis.fetch = async () => {
      fetchCalls += 1
      return {
        status: 200,
        ok: true,
        json: async () => ({
          status: 1,
          product: { code: '3017620422003', product_name: 'Fresh', nutriments: {} },
        }),
      }
    }
    const result = await lookupProduct('3017620422003', { refresh: true })
    assert.equal(fetchCalls, 1)
    assert.equal(result.cached, false)
    assert.equal(result.product.name, 'Fresh')
  })
})
