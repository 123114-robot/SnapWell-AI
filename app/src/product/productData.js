const API_ROOT = 'https://world.openfoodfacts.org/api/v3/product'
const CACHE_PREFIX = 'snapwell-product-v3:'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// GS1 documentation uses this valid-checksum GTIN as a barcode illustration.
// Mock product artwork sometimes embeds those example bars while printing the
// real product digits underneath, so looking it up can return an unrelated
// community record even though the decoder did its job correctly.
const PLACEHOLDER_BARCODES = new Set(['9312345678907'])

const PRODUCT_FIELDS = [
  'code', 'product_name', 'brands', 'quantity', 'categories_tags',
  'ingredients_text', 'allergens_tags', 'traces_tags', 'additives_tags',
  'ingredients_analysis_tags', 'labels_tags', 'nutriments', 'nutrient_levels',
  'nutrition_data_per', 'serving_size', 'last_modified_t',
]

const ALLERGY_GROUPS = {
  'No shellfish': ['crustaceans', 'molluscs', 'shellfish'],
  'No nuts': [
    'nuts', 'peanuts', 'almonds', 'brazil-nuts', 'cashews', 'hazelnuts',
    'macadamia-nuts', 'pecans', 'pine-nuts', 'pistachios', 'walnuts',
  ],
  'No eggs': ['eggs'],
  'No soy': ['soybeans', 'soy'],
  'No milk': ['milk', 'dairy'],
  'No wheat': ['wheat', 'spelt', 'kamut'],
  'No sesame': ['sesame-seeds', 'sesame'],
  'No fish': ['fish'],
  'No lupin': ['lupin'],
  'No sulphites': [
    'sulphites', 'sulfites', 'sulphur-dioxide-and-sulphites',
    'sulfur-dioxide-and-sulfites',
  ],
}

const OCR_ALLERGEN_ALIASES = {
  milk: 'milk', dairy: 'milk', egg: 'eggs', eggs: 'eggs', soy: 'soybeans',
  soya: 'soybeans', soybean: 'soybeans', soybeans: 'soybeans',
  peanut: 'peanuts', peanuts: 'peanuts', sesame: 'sesame-seeds',
  wheat: 'wheat', gluten: 'gluten', fish: 'fish', lupin: 'lupin',
  almond: 'almonds', almonds: 'almonds', cashew: 'cashews', cashews: 'cashews',
  hazelnut: 'hazelnuts', hazelnuts: 'hazelnuts', walnut: 'walnuts', walnuts: 'walnuts',
  pistachio: 'pistachios', pistachios: 'pistachios', pecan: 'pecans', pecans: 'pecans',
  mollusc: 'molluscs', molluscs: 'molluscs', crustacean: 'crustaceans',
  crustaceans: 'crustaceans', shellfish: 'shellfish', sulphite: 'sulphites',
  sulphites: 'sulphites', sulfite: 'sulfites', sulfites: 'sulfites',
}

export function normaliseBarcode(value) {
  const code = String(value || '').replace(/[^0-9]/g, '')
  if (![8, 12, 13, 14].includes(code.length)) return ''
  const digits = [...code].map(Number)
  const check = digits.pop()
  const sum = digits.reverse().reduce(
    (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
    0,
  )
  return (10 - (sum % 10)) % 10 === check ? code : ''
}

export function isPlaceholderBarcode(value) {
  return PLACEHOLDER_BARCODES.has(String(value || '').replace(/[^0-9]/g, ''))
}

function tagName(tag) {
  return String(tag || '').toLowerCase().replace(/^[a-z]{2}:/, '')
}

function tags(values) {
  return Array.isArray(values) ? [...new Set(values.map(tagName).filter(Boolean))] : []
}

function numberOrNull(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * Australian Daily Intake reference values (AFGC Daily Intake Guide, the
 * 8700 kJ average adult diet the "%DI* Per Serving" column on every local
 * label is calculated against). Used to check a recognised value, not to give
 * dietary advice: if a candidate reading does not reproduce the percentage
 * the label itself printed, the reading is wrong.
 */
const DAILY_INTAKE_REFERENCE = {
  energyKj: 8700, proteinG: 50, fatG: 70, saturatedFatG: 24,
  carbohydrateG: 310, sugarsG: 90, fibreG: 30, sodiumMg: 2300,
}

const NUTRIENT_ROWS = [
  { key: 'energyKj', label: /\benergy\b/i, unit: 'kj' },
  { key: 'proteinG', label: /\bprotein\b/i, unit: 'g' },
  { key: 'fatG', label: /\bfat\b/i, reject: /saturat|trans|polyunsat|monounsat/i, unit: 'g' },
  { key: 'saturatedFatG', label: /\bsaturated\b/i, unit: 'g' },
  { key: 'carbohydrateG', label: /\bcarbohydrate\b/i, reject: /\bsugar/i, unit: 'g' },
  { key: 'sugarsG', label: /\bsugars?\b/i, unit: 'g' },
  { key: 'fibreG', label: /\bfib(?:re|er)\b/i, unit: 'g' },
  { key: 'sodiumMg', label: /\bsodium\b/i, unit: 'mg' },
]

/**
 * Substitutions Tesseract makes on the tight, small print of a nutrition
 * panel, measured against app/src/ai/fixtures/labels. The unit glyph is the
 * last thing on a cell and the most damaged: "1.0g" comes back as "1.09",
 * "<1.0g" as "<10q", "284mg" as "284ma", "168kJ" as "168k]".
 */
function repairCellUnits(cell) {
  return cell
    .replace(/k\s*[\]}|1I]/gi, 'kJ')
    .replace(/\bma\b/gi, 'mg')
    .replace(/[q¢]/gi, 'g')
}

/**
 * Every reading of one cell that the OCR text could plausibly represent.
 *
 * A decimal point is a single light pixel column and is the first thing lost
 * on a low-contrast panel, so "1.5g" arrives as "159" (point dropped, "g"
 * read as "9") and "1.3g" as "13g". Both a one-decimal-place reading and the
 * literal one are therefore offered; the caller picks between them using the
 * label's own %DI column, never by guessing.
 */
function cellCandidates(raw) {
  const cell = repairCellUnits(raw)
  const match = cell.match(/(\d+(?:[.,]\d+)?)\s*(kcal|kj|cal|mg|g)?/i)
  if (!match) return null
  const literal = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(literal)) return null

  const unit = (match[2] || '').toLowerCase()
  const digits = match[1].replace(',', '.')
  const values = []
  const offer = (value) => {
    if (Number.isFinite(value) && !values.includes(value)) values.push(value)
  }

  // Most likely first. A panel cell always carries a unit, so a cell that
  // came back without one and ends in "9" is a misread unit glyph before it
  // is a real digit: "1.09" is "1.0g" and "159" is "15g".
  if (!unit && digits.length > 1 && digits.endsWith('9')) {
    const stripped = Number(digits.slice(0, -1))
    offer(stripped)
    if (!digits.includes('.')) offer(stripped / 10)
  }
  offer(literal)
  // A decimal point is one light pixel column and drops out easily.
  if (!digits.includes('.')) offer(literal / 10)

  return {
    unit,
    lessThan: /^\s*[<(]/.test(cell) || /less\s+than/i.test(cell),
    values,
  }
}

function toKey(value, unit, key) {
  if (key === 'energyKj') return unit === 'kcal' || unit === 'cal' ? value * 4.184 : value
  if (key === 'sodiumMg') return unit === 'g' ? value * 1000 : value
  return value
}

/**
 * Split a nutrient row into its cells. An Australian panel prints
 * "<name> <per serving> <%DI> <per 100 g>", so the percent cell marks the
 * boundary between the two quantity columns.
 */
function splitRowCells(line, labelPattern) {
  const body = line.replace(new RegExp(labelPattern.source, 'i'), ' ')
    .replace(/^[^0-9<]*/, '')
  const cells = body.match(
    /(?:less\s+than\s*|[<(]\s*)?\d+(?:[.,]\d+)?\s*(?:kcal|kJ|cal|mg|ma|kj|[gq¢%\]])?/gi,
  ) || []
  const percentAt = cells.findIndex((cell) => cell.includes('%'))
  if (percentAt < 0) return { perServing: cells.at(-1) || null, percent: null, per100: null }
  return {
    perServing: cells.slice(0, percentAt).at(-1) || null,
    percent: cells[percentAt],
    per100: cells.slice(percentAt + 1).at(-1) || null,
  }
}

/**
 * Choose the reading of a cell that reproduces the label's own printed %DI.
 * The percentages are printed as whole numbers, so allow the rounding slack
 * that implies; a reading that is out by a factor of ten never survives it.
 */
function pickByDailyIntake(candidates, key, printedPercent) {
  const reference = DAILY_INTAKE_REFERENCE[key]
  if (!reference || printedPercent == null) return null
  for (const value of candidates) {
    const implied = (toKey(value, '', key) / reference) * 100
    // Candidates arrive most-likely-first, so accept the first one the
    // percentage tolerates rather than the closest. "1.09" reads as 1.09 and
    // as 1.0g; both reproduce a printed 1%, and 1.0g is what the label says.
    if (Math.abs(implied - printedPercent) <= Math.max(0.75, printedPercent * 0.25)) {
      return value
    }
  }
  return null
}

function pickNearest(candidates, target) {
  let best = null
  for (const value of candidates) {
    const drift = Math.abs(value - target) / Math.max(Math.abs(target), 0.001)
    if (!best || drift < best.drift) best = { value, drift }
  }
  return best
}

function servingSizeGrams(text) {
  const match = String(text || '').match(/serving\s*size\s*:?\s*(\d+(?:[.,]\d+)?)\s*(g|ml)/i)
  return match ? Number(match[1].replace(',', '.')) : null
}

/**
 * Read one nutrient from the panel.
 *
 * The per-100 g column sits hard against the table border and is the worst
 * recognised, so it is never trusted on its own. The per-serving cell is
 * confirmed against the %DI column first, then scaled by the serving size;
 * the printed per-100 g cell only gets to override that when it independently
 * agrees. When nothing can be confirmed the nutrient is reported as unknown
 * rather than as a number nobody checked.
 */
function readNutrientRow(lines, spec, servingSize, bound = null) {
  // The scan concatenates several recognition passes over the same label, so
  // one nutrient usually appears more than once at different quality: a
  // shredded sparse line that carries a neighbouring column's number, and the
  // intact single-block row. Read every occurrence and keep the best, rather
  // than whichever happened to land first in the combined text.
  let fallback = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!spec.label.test(line) || spec.reject?.test(line)) continue

    const cells = splitRowCells(line, spec.label)
    const perServing = cells.perServing ? cellCandidates(cells.perServing) : null
    const per100 = cells.per100 ? cellCandidates(cells.per100) : null
    const printedPercent = cells.percent ? cellCandidates(cells.percent)?.values[0] ?? null : null
    if (!perServing && !per100) continue

    // A sub-row can never exceed the row it sits under, so a reading that
    // breaks that is not a reading at all. Filtering here, before a value is
    // chosen, lets the next-most-likely candidate win instead.
    const withinBound = (values) => (
      bound == null ? values : values.filter((value) => value <= bound * 1.05)
    )

    const scale = servingSize ? 100 / servingSize : null
    const confirmed = perServing && !perServing.lessThan
      ? pickByDailyIntake(
        withinBound(perServing.values.map((value) => toKey(value, perServing.unit, spec.key))),
        spec.key,
        printedPercent,
      )
      : null

    // Path 1: the %DI column confirmed the per-serving reading, so scale it.
    if (confirmed != null && scale != null) {
      const derived = confirmed * scale
      const direct = per100
        ? pickNearest(withinBound(per100.values.map((v) => toKey(v, per100.unit, spec.key))), derived)
        : null
      // The printed per-100 g cell is the label's own rounding, so prefer it
      // when it lands on the derived value; otherwise keep the derivation.
      const useDirect = direct && (direct.drift < 0.03 || per100.lessThan)
      return {
        value: useDirect ? direct.value : derived,
        lessThan: Boolean(per100?.lessThan || perServing.lessThan),
        confirmed: true,
      }
    }

    // Path 2: a "less than" row is printed unscaled in both columns, and a
    // panel with no %DI column gives nothing to confirm against. Fall back to
    // the printed per-100 g cell, disambiguated by the per-serving reading.
    const source = per100 || perServing
    if (!source) continue
    const values = withinBound(source.values.map((value) => toKey(value, source.unit, spec.key)))
    if (!values.length || fallback) continue
    if (perServing && per100 && scale != null) {
      const nearest = pickNearest(values, (perServing.values[0] ?? 0) * scale)
      if (nearest && nearest.drift < 0.35) {
        fallback = { value: nearest.value, lessThan: source.lessThan, confirmed: false }
        continue
      }
    }
    // Nothing to disambiguate against (a panel with no %DI column, or a single
    // quantity column). The literal reading is what the OCR actually saw, so
    // report that rather than a decimal-point hypothesis nothing corroborates.
    fallback = { value: values[0], lessThan: source.lessThan, confirmed: false }
  }
  // Only an unconfirmed reading was found anywhere in the text.
  return fallback
}

/**
 * Parse an Australian nutrition information panel out of recognised label text.
 *
 * Feed this SINGLE_BLOCK output: SPARSE_TEXT puts every table cell on its own
 * line in column order, which destroys the row structure this relies on.
 */
export function parseNutritionPanel(text) {
  const lines = String(text || '').split(/\n|\r/).map((line) => line.trim()).filter(Boolean)
  const servingSize = servingSizeGrams(text)
  const found = {}
  const lessThan = {}
  let confirmedCount = 0

  // "— Saturated" and "— Sugars" are printed as sub-rows of "Fat, Total" and
  // "Carbohydrate", so read the parents first and use them as ceilings. On a
  // panel where the decimal point was lost in both columns of a sub-row, that
  // ceiling is the only thing left that can tell "<1.0g" from "<10g".
  const SUB_ROW_PARENT = { saturatedFatG: 'fatG', sugarsG: 'carbohydrateG' }
  const record = (spec, read) => {
    found[spec.key] = read?.value ?? null
    if (read?.lessThan) lessThan[spec.key] = true
    if (read?.confirmed) confirmedCount += 1
  }

  for (const spec of NUTRIENT_ROWS.filter((item) => !SUB_ROW_PARENT[item.key])) {
    record(spec, readNutrientRow(lines, spec, servingSize))
  }
  for (const spec of NUTRIENT_ROWS.filter((item) => SUB_ROW_PARENT[item.key])) {
    record(spec, readNutrientRow(lines, spec, servingSize, found[SUB_ROW_PARENT[spec.key]]))
  }

  const readCount = NUTRIENT_ROWS.filter((spec) => found[spec.key] != null).length
  const looksLikePanel = /nutrition\s+information/i.test(text)
    || /per\s*100\s*(?:g|ml)/i.test(text)
    || readCount >= 3
  if (!looksLikePanel || readCount < 3) return null

  return {
    ...found,
    lessThan,
    servingSizeG: servingSize,
    // How many rows the label's own %DI column corroborated. A panel read
    // without that cross-check is shown, but the caller can warn about it.
    confirmedRows: confirmedCount,
  }
}

export function normaliseProduct(raw, barcode) {
  const nutriments = raw?.nutriments || {}
  const nutrientLevels = raw?.nutrient_levels || {}
  return {
    barcode: String(raw?.code || barcode || ''),
    name: String(raw?.product_name || '').trim() || 'Unknown packaged food',
    brand: String(raw?.brands || '').split(',')[0].trim(),
    quantity: String(raw?.quantity || '').trim(),
    categories: tags(raw?.categories_tags),
    ingredientsText: String(raw?.ingredients_text || '').trim(),
    allergens: tags(raw?.allergens_tags),
    traces: tags(raw?.traces_tags),
    additives: tags(raw?.additives_tags),
    dietaryTags: tags(raw?.ingredients_analysis_tags),
    labels: tags(raw?.labels_tags),
    nutritionPer100g: {
      energyKj: numberOrNull(nutriments['energy-kj_100g'])
        ?? numberOrNull(nutriments.energy_100g)
        ?? (numberOrNull(nutriments['energy-kcal_100g']) == null
          ? null
          : numberOrNull(nutriments['energy-kcal_100g']) * 4.184),
      fatG: numberOrNull(nutriments.fat_100g),
      sugarsG: numberOrNull(nutriments.sugars_100g),
      sodiumMg: numberOrNull(nutriments.sodium_100g) == null
        ? null
        : numberOrNull(nutriments.sodium_100g) * 1000,
      saturatedFatG: numberOrNull(nutriments['saturated-fat_100g']),
      proteinG: numberOrNull(nutriments.proteins_100g),
      fibreG: numberOrNull(nutriments.fiber_100g ?? nutriments.fibre_100g),
    },
    nutrientLevels: {
      sugars: nutrientLevels.sugars || null,
      sodium: nutrientLevels.salt || nutrientLevels.sodium || null,
      saturatedFat: nutrientLevels['saturated-fat'] || null,
    },
    completeness: {
      ingredients: Boolean(raw?.ingredients_text),
      allergens: Array.isArray(raw?.allergens_tags),
      traces: Array.isArray(raw?.traces_tags),
      nutrition: ['sugars_100g', 'sodium_100g', 'saturated-fat_100g']
        .every((key) => numberOrNull(nutriments[key]) != null),
    },
    source: {
      type: 'open-food-facts',
      retrievedAt: new Date().toISOString(),
      sourceUpdatedAt: raw?.last_modified_t
        ? new Date(Number(raw.last_modified_t) * 1000).toISOString()
        : null,
    },
    ocrText: '',
  }
}

export function readCachedProduct(barcode) {
  try {
    const item = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${barcode}`))
    if (!item?.product || Date.now() - item.savedAt > CACHE_TTL_MS) return null
    return item.product
  } catch {
    return null
  }
}

export function saveCachedProduct(product) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${product.barcode}`, JSON.stringify({
      savedAt: Date.now(), product,
    }))
  } catch {
    // A full or disabled browser store should not prevent the safety report.
  }
}

export async function lookupProduct(barcode, { refresh = false } = {}) {
  const code = normaliseBarcode(barcode)
  if (!code) throw new Error('Enter a valid EAN or UPC barcode.')
  if (isPlaceholderBarcode(code)) {
    throw new Error('This is a known example barcode, not a reliable product identifier. Enter the digits printed below the bars.')
  }
  if (!refresh) {
    const cached = readCachedProduct(code)
    if (cached) return { product: cached, cached: true }
  }

  const url = `${API_ROOT}/${encodeURIComponent(code)}.json?fields=${PRODUCT_FIELDS.join(',')}`
  const response = await fetch(url)
  if (response.status === 404) return { product: null, cached: false }
  if (!response.ok) throw new Error(`Product lookup failed (${response.status}).`)
  const body = await response.json()
  if (body.status === 0 || !body.product) return { product: null, cached: false }
  const product = normaliseProduct(body.product, code)
  saveCachedProduct(product)
  return { product, cached: false }
}

function aliasesIn(value) {
  const words = String(value || '').toLowerCase().match(/[a-z]+/g) || []
  return [...new Set(words.map((word) => OCR_ALLERGEN_ALIASES[word]).filter(Boolean))]
}

export function parseAllergenStatements(text) {
  const contains = new Set()
  const traces = new Set()
  for (const line of String(text || '').split(/\n|\r|\./)) {
    if (/\bmay\s+(?:contain|be\s+present)\b/i.test(line)) {
      aliasesIn(line).forEach((item) => traces.add(item))
    } else if (/\bcontains?\b/i.test(line)) {
      aliasesIn(line).forEach((item) => contains.add(item))
    }
  }
  return { contains: [...contains], traces: [...traces] }
}

export function addOcrEvidence(product, ocrText) {
  if (!product || !ocrText?.trim()) return product
  const parsed = parseAllergenStatements(ocrText)
  const merged = {
    ...product,
    allergens: [...new Set([...product.allergens, ...parsed.contains])],
    traces: [...new Set([...product.traces, ...parsed.traces])],
    ocrText: ocrText.trim(),
    completeness: {
      ...product.completeness,
      allergens: product.completeness.allergens || parsed.contains.length > 0,
      traces: product.completeness.traces || parsed.traces.length > 0,
    },
  }
  saveCachedProduct(merged)
  return merged
}

function matchesGroup(productTags, group) {
  return group.some((candidate) => productTags.includes(candidate))
}

export function assessProductSafety(product, preferences = {}) {
  const selected = preferences.allergies || []
  return selected.filter((name) => ALLERGY_GROUPS[name]).map((name) => {
    const group = ALLERGY_GROUPS[name]
    if (matchesGroup(product.allergens, group)) {
      return { preference: name, status: 'conflict', detail: 'Declared as containing this allergen.' }
    }
    if (matchesGroup(product.traces, group)) {
      return { preference: name, status: 'trace', detail: 'The product may contain this allergen.' }
    }
    if (product.completeness.allergens && product.completeness.traces) {
      return { preference: name, status: 'clear', detail: 'Not found in the available declarations.' }
    }
    return { preference: name, status: 'unknown', detail: 'The available allergen information is incomplete.' }
  })
}

export function dietaryStatus(product, kind) {
  if (kind === 'gluten-free') {
    if (product.labels?.some((tag) => ['gluten-free', 'no-gluten'].includes(tag))) return 'yes'
    if (product.allergens.some((tag) => [
      'gluten', 'wheat', 'barley', 'rye', 'oats', 'spelt', 'kamut',
    ].includes(tag))) return 'no'
    return 'unknown'
  }
  if (kind === 'dairy-free') {
    if (product.labels?.some((tag) => ['dairy-free', 'milk-free', 'no-milk'].includes(tag))) return 'yes'
    if (product.allergens.includes('milk')) return 'no'
    if (product.dietaryTags.includes('vegan')) return 'yes'
    return 'unknown'
  }
  const yes = kind === 'vegan' ? 'vegan' : 'vegetarian'
  const no = kind === 'vegan' ? 'non-vegan' : 'non-vegetarian'
  if (product.dietaryTags.some((tag) => tag === no)) return 'no'
  if (product.dietaryTags.some((tag) => tag === yes)) return 'yes'
  return 'unknown'
}
