import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { allLabels, loadIngredientIndex, matchIngredients } from '../ai/ingredientMatch.js'
import { useAppState } from '../state/useAppState.js'
import {
  addOcrEvidence, assessProductSafety, dietaryStatus, lookupProduct, normaliseBarcode,
} from '../product/productData.js'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332', greenSoft: '#E7EFE9',
  greenLine: '#CBDDD0', wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC', muted: '#5E6E64', line: '#E4E0D6',
}

const STATUS = {
  conflict: { icon: '!', label: 'Conflict', fg: '#A62F18', bg: '#F8E3DC' },
  trace: { icon: '△', label: 'May contain', fg: '#7A5200', bg: '#FBEECB' },
  clear: { icon: '✓', label: 'Not found', fg: '#1B4332', bg: '#E7EFE9' },
  unknown: { icon: '?', label: 'Unknown', fg: '#5E6E64', bg: '#EEEAE1' },
}

const titleCase = (value) => String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function ProductReport() {
  const { barcode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { preferences, setIngredients } = useAppState()
  const backTo = location.state?.from || '/capture'
  const [state, setState] = useState({ loading: true, product: null, cached: false, error: '' })
  const [index, setIndex] = useState(null)
  const [selectedLabel, setSelectedLabel] = useState('')
  const [showRaw, setShowRaw] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [manualError, setManualError] = useState('')

  async function refreshProduct() {
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const result = await lookupProduct(barcode, { refresh: true })
      const product = addOcrEvidence(result.product, location.state?.ocrText)
      setState({ loading: false, product, cached: result.cached, error: '' })
    } catch (error) {
      setState({ loading: false, product: null, cached: false, error: error.message })
    }
  }

  function submitManualBarcode(event) {
    event.preventDefault()
    const code = normaliseBarcode(manualBarcode)
    if (!code) {
      setManualError('Enter a valid 8, 12, 13 or 14 digit retail barcode.')
      return
    }
    setManualError('')
    setState((previous) => ({ ...previous, loading: true, error: '' }))
    navigate(`/product/${code}`, { replace: true, state: { from: backTo } })
  }

  useEffect(() => {
    let cancelled = false
    lookupProduct(barcode)
      .then((result) => {
        if (cancelled) return
        const product = addOcrEvidence(result.product, location.state?.ocrText)
        setState({ loading: false, product, cached: result.cached, error: '' })
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, product: null, cached: false, error: error.message })
      })
    return () => { cancelled = true }
  }, [barcode, location.state?.ocrText])
  useEffect(() => {
    let cancelled = false
    loadIngredientIndex().then((value) => { if (!cancelled) setIndex(value) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const product = state.product
  const isLocalOcr = product?.source?.type === 'local-ocr'
  const matches = useMemo(() => {
    if (!product || !index) return []
    const identity = [product.name, product.categories.join(' ')].join('\n').replace(/-/g, ' ')
    return matchIngredients(identity, index, { limit: 6 })
  }, [product, index])
  const labels = useMemo(() => index ? allLabels(index) : [], [index])

  const effectiveLabel = selectedLabel || matches[0]?.label || ''

  const safety = useMemo(
    () => product ? assessProductSafety(product, preferences) : [],
    [product, preferences],
  )

  function addToIngredients() {
    if (!effectiveLabel || !product) return
    const matched = matches.find((item) => item.label === effectiveLabel)
    const worst = safety.some((item) => item.status === 'conflict')
      ? 'conflict'
      : safety.some((item) => item.status === 'trace') ? 'trace'
        : safety.some((item) => item.status === 'unknown') ? 'unknown' : 'clear'
    setIngredients((previous) => {
      const existing = previous.findIndex((item) => item.label === effectiveLabel)
      if (existing >= 0) {
        return previous.map((item, index) => index === existing ? {
          ...item,
          quantity: (item.quantity || 1) + 1,
          productName: item.productName || product.name,
          barcode: item.barcode || product.barcode,
          safetyStatus: worst,
        } : item)
      }
      return [...previous, {
        id: `product-${product.barcode}-${Date.now()}`,
        label: effectiveLabel,
        confidence: matched?.score ?? null,
        quantity: 1,
        unit: 'piece',
        source: 'product',
        bbox: null,
        barcode: product.barcode,
        productName: product.name,
        brand: product.brand,
        safetyStatus: worst,
        ocrText: product.ocrText,
        ausnutKey: matched?.ausnutKey ?? null,
      }]
    })
    navigate('/confirm')
  }

  const card = { background: '#fff', border: `1px solid ${T.line}`, borderRadius: 16, padding: 16 }
  const primary = {
    width: '100%', border: 'none', borderRadius: 14, padding: '14px 18px',
    background: T.green, color: '#fff', fontFamily: 'inherit', fontWeight: 600,
    fontSize: 15, cursor: 'pointer',
  }

  if (state.loading) return (
    <div style={{ minHeight: '100vh', background: T.paper, display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', color: T.green }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 34 }}>▥</div><div style={{ marginTop: 10, fontWeight: 600 }}>Looking up product…</div></div>
    </div>
  )

  if (state.error || !product) return (
    <div style={{ minHeight: '100vh', background: T.paper, maxWidth: 430, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <button type="button" onClick={() => navigate('/scan-package', { state: { from: backTo } })} style={{ border: 'none', background: 'none', color: T.green, fontSize: 15, cursor: 'pointer' }}>‹ Scan again</button>
      <div style={{ marginTop: 20, fontSize: 23, fontWeight: 700, color: T.ink }}>
        {state.error ? 'Product lookup unavailable' : 'Product not found'}
      </div>
      <p style={{ color: T.muted, lineHeight: 1.55 }}>
        {state.error || `Barcode ${barcode} is not in the product database yet.`}
      </p>
      <form onSubmit={submitManualBarcode} style={{ ...card, marginTop: 14 }}>
        <label htmlFor="manual-product-barcode" style={{ fontSize: 12, color: T.muted, fontWeight: 700, letterSpacing: 0.5 }}>
          ENTER BARCODE MANUALLY
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input id="manual-product-barcode" value={manualBarcode} onChange={(event) => setManualBarcode(event.target.value)} inputMode="numeric" autoComplete="off" placeholder="8–14 digits" style={{
            minWidth: 0, flex: 1, border: `1.5px solid ${T.line}`, borderRadius: 12,
            padding: '12px 13px', fontFamily: 'inherit', fontSize: 16, background: '#fff',
          }} />
          <button type="submit" style={{ border: 'none', borderRadius: 12, padding: '0 16px', background: T.wattle, color: T.ink, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Look up</button>
        </div>
        {manualError && <div role="alert" style={{ color: T.tomato, fontSize: 12, fontWeight: 600, marginTop: 7 }}>{manualError}</div>}
      </form>
      <button type="button" onClick={refreshProduct} style={{ ...primary, marginTop: 10, background: '#fff', color: T.green, border: `1.5px solid ${T.greenLine}` }}>Try again</button>
    </div>
  )

  const nutrition = [
    ['Energy', product.nutritionPer100g.energyKj, 'kJ'],
    ['Protein', product.nutritionPer100g.proteinG, 'g'],
    ['Fat', product.nutritionPer100g.fatG, 'g'],
    ['Sugar', product.nutritionPer100g.sugarsG, 'g'],
    ['Fibre', product.nutritionPer100g.fibreG, 'g'],
    ['Sodium', product.nutritionPer100g.sodiumMg, 'mg'],
  ]

  return (
    <div style={{ minHeight: '100vh', background: T.paper, maxWidth: 430, margin: '0 auto', paddingBottom: 30, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '20px 20px 12px' }}>
        <button type="button" onClick={() => navigate('/scan-package', { state: { from: backTo } })} aria-label="Scan another product" style={{
          width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.line}`,
          background: '#fff', color: T.ink, cursor: 'pointer', fontSize: 22,
        }}>‹</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>{product.name}</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
            {[product.brand, product.quantity, product.barcode].filter(Boolean).join(' · ')}
          </div>
          {state.cached && <div style={{ color: T.green, fontSize: 11, fontWeight: 600, marginTop: 5 }}>Loaded from this device</div>}
        </div>
      </div>

      <div style={{ padding: '4px 20px 0', display: 'grid', gap: 12 }}>
        <section style={card}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, letterSpacing: 0.5 }}>ALLERGY CHECK</div>
          {safety.length === 0 ? (
            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5, color: T.muted }}>
              No allergy preferences are selected. Add them in Settings for a personalised check.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {safety.map((item) => {
                const visual = STATUS[item.status]
                return <div key={item.preference} style={{ background: visual.bg, color: visual.fg, borderRadius: 12, padding: '11px 12px', display: 'flex', gap: 10 }}>
                  <strong>{visual.icon}</strong>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {item.status === 'clear' ? item.preference : `${item.preference}: ${visual.label}`}
                    </div>
                    {item.status !== 'clear' && <div style={{ fontSize: 12, marginTop: 2 }}>{item.detail}</div>}
                  </div>
                </div>
              })}
            </div>
          )}
          {product.allergens.length > 0 && <div style={{ fontSize: 12, color: T.muted, marginTop: 10 }}>Declared: {product.allergens.map(titleCase).join(', ')}</div>}
          {product.traces.length > 0 && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>May contain: {product.traces.map(titleCase).join(', ')}</div>}
          {(!product.completeness.allergens || !product.completeness.traces) && (
            <button type="button" onClick={() => navigate('/scan-package/label', {
              state: { from: `/product/${barcode}`, productReturn: { barcode, from: backTo } },
            })} style={{
              width: '100%', border: `1.5px solid ${T.greenLine}`, borderRadius: 12,
              background: '#fff', color: T.green, padding: '11px 12px', marginTop: 12,
              fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer',
            }}>Scan Contains / May contain statement</button>
          )}
        </section>

        <section style={card}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, letterSpacing: 0.5 }}>DIETARY INFORMATION</div>
          <div style={{ marginTop: 10, display: 'grid', gap: 7, fontSize: 14, color: T.ink }}>
            <div>Gluten free: <strong>{titleCase(dietaryStatus(product, 'gluten-free'))}</strong></div>
            <div>Vegetarian: <strong>{titleCase(dietaryStatus(product, 'vegetarian'))}</strong></div>
            <div>Vegan: <strong>{titleCase(dietaryStatus(product, 'vegan'))}</strong></div>
            <div>Dairy free: <strong>{titleCase(dietaryStatus(product, 'dairy-free'))}</strong></div>
          </div>
        </section>

        <section style={card}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 700, letterSpacing: 0.5 }}>NUTRITION PER 100 G</div>
          <div style={{ marginTop: 8 }}>
            {nutrition.map(([name, value, unit]) => <div key={name} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.line}` }}>
              <span style={{ flex: 1, color: T.ink, fontSize: 14 }}>{name}</span>
              <strong style={{ color: T.ink, fontSize: 14 }}>{value == null ? 'Unknown' : `${Number(value.toFixed(1))} ${unit}`}</strong>
            </div>)}
          </div>
        </section>

        <section style={card}>
          <label htmlFor="ingredient-map" style={{ fontSize: 12, color: T.muted, fontWeight: 700, letterSpacing: 0.5 }}>ADD AS INGREDIENT</label>
          <select id="ingredient-map" value={effectiveLabel} onChange={(event) => setSelectedLabel(event.target.value)} style={{
            width: '100%', marginTop: 9, border: `1.5px solid ${T.line}`, borderRadius: 12,
            padding: '12px 13px', background: '#fff', color: T.ink, fontFamily: 'inherit', fontSize: 14,
          }}>
            <option value="">Choose the closest ingredient…</option>
            {labels.map((item) => <option key={item.label} value={item.label}>{item.displayName}</option>)}
          </select>
          {matches[0] && <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>Suggested from product name: {matches[0].displayName}</div>}
          <button type="button" disabled={!effectiveLabel} onClick={addToIngredients} style={{ ...primary, marginTop: 12, opacity: effectiveLabel ? 1 : 0.55 }}>Add to my ingredients</button>
        </section>

        <section style={{ ...card, background: T.greenSoft, borderColor: T.greenLine }}>
          <div style={{ fontSize: 12, color: T.green, fontWeight: 700, letterSpacing: 0.5 }}>AUSTRALIAN ADULT DAILY GUIDE</div>
          <div style={{ marginTop: 10, display: 'grid', gap: 9, fontSize: 13, lineHeight: 1.45, color: T.ink }}>
            <div><strong>Sodium:</strong> aim for no more than 2,000 mg/day.</div>
            <div><strong>Total fat:</strong> 20–35% of daily energy; saturated + trans fat no more than 10%.</div>
            <div><strong>Dietary fibre:</strong> 25 g/day for women; 30 g/day for men.</div>
            <div><strong>Protein (ages 19–70):</strong> women 0.75 g/kg/day (46 g reference); men 0.84 g/kg/day (64 g reference).</div>
            <div><strong>Added sugar:</strong> Australia sets no single gram limit for everyone—keep foods and drinks with added sugars limited. The Dietary Guidelines cite a 10%-of-energy benchmark (about 52 g/day on an 8,700 kJ diet).</div>
          </div>
          <div style={{ marginTop: 11, color: T.muted, fontSize: 11, lineHeight: 1.45 }}>
            Source: Australian NHMRC Nutrient Reference Values and Dietary Guidelines.
          </div>
        </section>

        <button type="button" onClick={() => setShowRaw((value) => !value)} style={{ border: 'none', background: 'none', color: T.green, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 8 }}>
          {showRaw ? 'Hide original product information' : 'View original product information'}
        </button>
        {showRaw && <section style={{ ...card, fontSize: 12, lineHeight: 1.55, color: T.muted, overflowWrap: 'anywhere' }}>
          <strong style={{ color: T.ink }}>Ingredients</strong><br />
          {product.ingredientsText || 'Not available'}
          {product.ocrText && <><br /><br /><strong style={{ color: T.ink }}>Confirmed OCR text</strong><br />{product.ocrText}</>}
          {product.nutritionOcrText && <><br /><br /><strong style={{ color: T.ink }}>Nutrition OCR text</strong><br />{product.nutritionOcrText}</>}
          <br /><br />Source: {isLocalOcr ? 'OCR processed on this device.' : 'Open Food Facts community data.'} Always check the physical package for allergy decisions.
        </section>}

        {!isLocalOcr && <button type="button" onClick={refreshProduct} style={{ border: 'none', background: 'none', color: T.muted, fontFamily: 'inherit', cursor: 'pointer', padding: 8 }}>Refresh product information</button>}
        <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.5, padding: '0 8px 4px', textAlign: 'center' }}>
          {isLocalOcr
            ? 'OCR can misread package text. For allergy decisions, always check the physical package.'
            : 'Community product data may be incomplete or out of date. For allergy decisions, always check the physical package.'}
        </div>

      </div>
    </div>
  )
}
