/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * 模型「控制标签」约定与解析。
 *
 * 复用模型元信息的 tags 字段做前端控制位，无需任何后端改动：
 *  - 角标：以 ! 开头的标签 → 卡片右上角彩色角标。可叠加多个。
 *      · 命中预设（!new / !火 / !极速 / !推荐，或 emoji）→ 自动带 emoji、配色与多语言
 *      · 其它任意文案（!⚡闪促、!-10%、!🎁）→ 原样渲染为促销样式角标
 *        ⚠ 自定义角标不做翻译，请用语言中立内容（数字 / 百分号 / emoji，如 !-10%、!🔥），
 *          避免写 !限时9折 这类纯中文——俄/英用户看不懂。
 *  - 精选：!精选_N（兼容 !精选N / 精选_N / featured_N）→ 进入首页精选区，N 为排序（小的在前，无序号默认 9999）
 *
 * 这些控制标签都会从可见标签（卡片标签列表、筛选按钮）中剔除。
 *
 * 示例 tags：`对话,Tools,!精选1,!new,!🔥,!-10%`
 * 想新增一种预设角标：往下面的 BADGE_DEFS 里加一行即可（无需改组件）。
 */

export type ModelBadgeVariant =
  | 'red'
  | 'orange'
  | 'amber'
  | 'blue'
  | 'green'
  | 'violet'
  | 'rose'

export type ModelBadge = {
  /** React key / 去重用 */
  key: string
  /** 角标 emoji 图标（可选） */
  icon?: string
  /** 直接展示的文案（i18nKey 优先） */
  label: string
  /** 可选 i18n key，用于随语言变化的角标（如 New→新） */
  i18nKey?: string
  variant: ModelBadgeVariant
}

type BadgeDef = {
  /** 命中的标签（小写匹配，含中英文与 emoji 别名） */
  match: string[]
  variant: ModelBadgeVariant
  icon?: string
  /** 固定展示文案 */
  label?: string
  /** 随语言变化的文案 key（与 label 二选一） */
  i18nKey?: string
}

/** 可识别的预设角标 —— 增删预设只改这里。 */
const BADGE_DEFS: BadgeDef[] = [
  { match: ['new', '新', '🆕'], variant: 'red', i18nKey: 'New' },
  { match: ['hot', '热', '火', '🔥'], variant: 'orange', icon: '🔥' },
  { match: ['turbo', 'fast', '极速', '⚡', '⚡️'], variant: 'amber', icon: '⚡' },
  { match: ['recommend', 'pick', '推荐'], variant: 'violet', icon: '⭐' },
]

// 小写标签 -> 预设角标定义 的索引
const BADGE_INDEX = new Map<string, BadgeDef>()
for (const def of BADGE_DEFS) {
  for (const m of def.match) BADGE_INDEX.set(m.toLowerCase(), def)
}

// 精选_1 / 精选1 / 精选-1 / featured:2 / featured 等；序号可选
const FEATURED_RE = /^(?:精选|featured)[\s_:：-]*(\d+)?$/i

const DEFAULT_FEATURED_ORDER = 9999

/** 角标颜色样式，供卡片渲染复用。 */
export const BADGE_VARIANT_CLASS: Record<ModelBadgeVariant, string> = {
  red: 'bg-red-500 text-white',
  orange: 'bg-orange-500 text-white',
  amber: 'bg-amber-400 text-white',
  blue: 'bg-blue-500 text-white',
  green: 'bg-emerald-500 text-white',
  violet: 'bg-violet-500 text-white',
  rose: 'bg-gradient-to-r from-rose-500 to-orange-500 text-white',
}

export type ParsedModelTags = {
  /** 右上角彩色角标，可有多个 */
  badges: ModelBadge[]
  isFeatured: boolean
  /** 越小越靠前；无序号时为 9999 */
  featuredOrder: number
  /** 已剔除控制标签后的普通标签 */
  visibleTags: string[]
}

export function parseModelTags(tags?: string): ParsedModelTags {
  const result: ParsedModelTags = {
    badges: [],
    isFeatured: false,
    featuredOrder: DEFAULT_FEATURED_ORDER,
    visibleTags: [],
  }
  if (!tags) return result

  const seen = new Set<string>()
  const pushBadge = (b: ModelBadge) => {
    if (seen.has(b.key)) return
    seen.add(b.key)
    result.badges.push(b)
  }

  for (const raw of tags.split(',')) {
    const tag = raw.trim()
    if (!tag) continue

    // 去掉可选的 ! / ！ 前缀，得到主体
    const hasBang = tag.startsWith('!') || tag.startsWith('！')
    const body = hasBang ? tag.slice(1).trim() : tag
    if (!body) continue

    // 精选_N（带不带 ! 都识别）
    const m = FEATURED_RE.exec(body)
    if (m) {
      result.isFeatured = true
      if (m[1] != null) {
        const order = Number.parseInt(m[1], 10)
        if (Number.isFinite(order)) result.featuredOrder = order
      }
      continue
    }

    // 角标：必须带 ! 前缀
    if (hasBang) {
      const def = BADGE_INDEX.get(body.toLowerCase())
      if (def) {
        pushBadge({
          key: def.variant,
          icon: def.icon,
          label: def.label ?? '',
          i18nKey: def.i18nKey,
          variant: def.variant,
        })
      } else {
        pushBadge({ key: `custom:${body}`, label: body, variant: 'rose' })
      }
      continue
    }

    // 普通可见标签
    result.visibleTags.push(body)
  }

  return result
}
