import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/AppState.jsx'

const T = {
  paper: '#FAF7F0', ink: '#12261C', green: '#1B4332',
  greenSoft: '#E7EFE9', greenLine: '#CBDDD0',
  wattle: '#E9A824', wattleSoft: '#FBEECB',
  tomato: '#D64525', tomatoSoft: '#F8E3DC',
  muted: '#5E6E64', line: '#E4E0D6',
}

// 示例食谱库（Sprint 2 会换成真实食谱 + AUSNUT 营养数据，结构一样）
export const RECIPES = [
  { id: 'tomato-pasta', name: 'Creamy Tomato Pasta', emoji: '🍝', time: 20, kcal: 420,
    tags: ['Vegetarian', 'Quick meal'],
    needs: ['pasta', 'tomato', 'milk', 'garlic'],
    nutrition: { protein: 18, carbs: 56, fat: 12, fibre: 4, sodium: 320 },
    steps: ['Boil pasta until al dente, then drain.',
            'Soften garlic, add chopped tomato, cook down.',
            'Stir in milk, simmer to a light sauce, season.',
            'Toss pasta through the sauce.'] },
  { id: 'tomato-soup', name: 'Tomato Soup', emoji: '🍲', time: 25, kcal: 210,
    tags: ['Low-calorie', 'Vegetarian'],
    needs: ['tomato', 'garlic', 'onion'],
    nutrition: { protein: 6, carbs: 28, fat: 7, fibre: 5, sodium: 290 },
    steps: ['Roast tomato, garlic and onion until soft.',
            'Blend until smooth, warm through and season.'] },
  { id: 'fruit-salad', name: 'Fresh Fruit Salad', emoji: '🥗', time: 10, kcal: 150,
    tags: ['Vegan', 'Low-calorie'],
    needs: ['apple', 'banana', 'orange'],
    nutrition: { protein: 2, carbs: 34, fat: 1, fibre: 6, sodium: 5 },
    steps: ['Chop all fruit into bite-size pieces.',
            'Toss together and chill before serving.'] },
  { id: 'veggie-stirfry', name: 'Veggie Stir-fry', emoji: '🥘', time: 18, kcal: 260,
    tags: ['Vegan', 'High-protein'],
    needs: ['broccoli', 'carrot', 'garlic', 'onion'],
    nutrition: { protein: 12, carbs: 30, fat: 9, fibre: 8, sodium: 340 },
    steps: ['Chop all vegetables.',
            'Stir-fry garlic and onion, add veg, cook until tender-crisp.',
            'Season and serve.'] },
  { id: 'cheese-omelette', name: 'Cheese Omelette', emoji: '🍳', time: 12, kcal: 330,
    tags: ['Vegetarian', 'High-protein'],
    needs: ['egg', 'cheese', 'milk'],
    nutrition: { protein: 22, carbs: 4, fat: 25, fibre: 0, sodium: 380 },
    steps: ['Whisk eggs with a splash of milk.',
            'Cook gently, add cheese, fold and serve.'] },
  { id: 'roast-potato', name: 'Garlic Roast Potatoes', emoji: '🥔', time: 40, kcal: 290,
    tags: ['Vegan'],
    needs: ['potato', 'garlic'],
    nutrition: { protein: 5, carbs: 48, fat: 9, fibre: 5, sodium: 220 },
    steps: ['Cut potatoes into chunks.',
            'Toss with oil and garlic, roast until golden.'] },
]

// 匹配计算：命中的食材数 / 食谱需要的食材数
export function scoreRecipe(recipe, have) {
  const haveSet = new Set(have.map(h => String(h.label).toLowerCase()))
  const hit = recipe.needs.filter(n => haveSet.has(n))
  const missing = recipe.needs.filter(n => !haveSet.has(n))
  const score = Math.round((hit.length / recipe.needs.length) * 100)
  return { score, hit, missing }
}

export default function Recommendations() {
  const navigate = useNavigate()
  const { ingredients } = useAppState()

  // 给每道食谱打分，过滤掉完全不沾边的，按分数排序
  const ranked = RECIPES
    .map(r => ({ ...r, ...scoreRecipe(r, ingredients) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)

  return (
    <div style={{
      minHeight: '100vh', background: T.paper, fontFamily: 'system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 12px' }}>
        <button onClick={() => navigate('/quantity')} style={{
          background: '#fff', border: `1px solid ${T.line}`, borderRadius: 10,
          width: 34, height: 34, display: 'grid', placeItems: 'center',
          cursor: 'pointer', color: T.ink, flexShrink: 0, marginTop: 3,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Recommended for you</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
            Based on what you have
          </div>
        </div>
      </div>

      {/* 食谱卡片列表 */}
      <div style={{ padding: '4px 20px 0', display: 'grid', gap: 14 }}>
        {ranked.length === 0 && (
          <div style={{
            background: '#fff', border: `1px dashed ${T.line}`, borderRadius: 14,
            padding: 24, textAlign: 'center', color: T.muted, fontSize: 14,
          }}>
            No matching recipes yet. Go back and add a few common ingredients
            like tomato, egg or pasta.
          </div>
        )}

        {ranked.map(r => (
          <button key={r.id} onClick={() => navigate('/recipe/' + r.id)} style={{
            textAlign: 'left', background: '#fff', border: `1px solid ${T.line}`,
            borderRadius: 18, overflow: 'hidden', cursor: 'pointer', padding: 14,
            display: 'flex', gap: 14,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 14, background: T.greenSoft,
              display: 'grid', placeItems: 'center', fontSize: 34, flexShrink: 0,
            }}>{r.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: T.ink }}>{r.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontFamily: 'monospace', fontSize: 12, color: T.green, fontWeight: 700,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.wattle }} />
                  {r.score}% match
                </span>
                <span style={{ fontSize: 12, color: T.muted }}>· {r.kcal} kcal · {r.time} min</span>
              </div>
              {/* 缺的食材提示 */}
              {r.missing.length > 0 && (
                <div style={{ fontSize: 12, color: T.tomato, marginTop: 6 }}>
                  Missing: {r.missing.join(', ')}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {r.tags.map(t => (
                  <span key={t} style={{
                    background: T.greenSoft, color: T.green, fontWeight: 600,
                    fontSize: 11, padding: '3px 8px', borderRadius: 999,
                  }}>{t}</span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}