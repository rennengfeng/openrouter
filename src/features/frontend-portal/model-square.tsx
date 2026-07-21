import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search, MessageSquare, X, Copy, Type, Image as ImageIcon, AudioLines, Video, Eye, Wrench, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { getLobeIcon } from '@/lib/lobe-icon'
import { getFrontendModels } from './api'
import { parseModelTags } from './model-tags'
import { ModelBadges } from './model-badges'
import { ModelModalityBadge } from './model-modality-badge'
import { ModelModalities } from './model-modalities'
import type { FrontendModel } from './types'
import { Link } from '@tanstack/react-router'
import {
  parseTiersFromExpr,
  splitBillingExprAndRequestRules,
  type ParsedTier,
  type TierCondition,
} from '@/features/pricing/lib/billing-expr'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type PriceMode = 'site' | 'official'

type ModelRow = {
  model: FrontendModel
  group: string
  ratio: number
}

function formatCurrencyAmount(value: number, symbol: '$' | '¥'): string {
  if (!Number.isFinite(value)) return '-'
  return `${symbol}${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })}`
}

// 固定 5 个标签的多语言：管理员可写中文或英文，按界面语言显示；其它标签原样显示。
// key 为小写，查找时对原始标签做 toLowerCase 兜底，兼容大小写。
const TAG_I18N_KEY: Record<string, string> = {
  '文本推理': 'portal.tag.text', text: 'portal.tag.text',
  '图像': 'portal.tag.image', image: 'portal.tag.image',
  '音频': 'portal.tag.voice', voice: 'portal.tag.voice',
  '视频': 'portal.tag.video', video: 'portal.tag.video',
  '视觉': 'portal.tag.visual', visual: 'portal.tag.visual',
  reasoning: 'portal.tag.text', '推理': 'portal.tag.text',
  tools: 'portal.tag.tools', '工具': 'portal.tag.tools',
  files: 'portal.tag.files', file: 'portal.tag.files', '文件': 'portal.tag.files',
  vision: 'portal.tag.visual',
}

// 筛选「类型」白名单：只这几类出现在筛选条（卡片标签不受影响）。aliases 小写匹配。
const FILTER_CATEGORIES = [
  { key: 'text', i18n: 'portal.tag.text', aliases: ['text', 'reasoning', '文本推理', '推理'] },
  { key: 'image', i18n: 'portal.tag.image', aliases: ['image', '图像', '图片'] },
  { key: 'voice', i18n: 'portal.tag.voice', aliases: ['voice', 'audio', '音频', '语音'] },
  { key: 'video', i18n: 'portal.tag.video', aliases: ['video', '视频'] },
  { key: 'visual', i18n: 'portal.tag.visual', aliases: ['visual', 'vision', '视觉'] },
  { key: 'tools', i18n: 'portal.tag.tools', aliases: ['tools', '工具', '工具调用'] },
  { key: 'file', i18n: 'portal.tag.files', aliases: ['file', 'files', '文件', '文档'] },
] as const

const CAT_ICON = { text: Type, image: ImageIcon, voice: AudioLines, video: Video, visual: Eye, tools: Wrench, file: FileText } as const

function formatPrice(
  model: FrontendModel,
  type: 'input' | 'output' | 'cache_create' | 'cache_read',
  mode: PriceMode,
  ratio: number,
  t: (key: string) => string,
  symbol: '$' | '¥'
): string {
  if (model.quota_type === 1) {
    if (type === 'input') {
      const modelPrice = mode === 'official'
        ? Number(model.official_model_price ?? model.model_price ?? 0)
        : Number(model.model_price ?? 0)
      const r = mode === 'site' ? ratio : 1
      return `${formatCurrencyAmount(modelPrice * r, symbol)} / ${fixedBillingUnitLabel(model, t)}`
    }
    return '-'
  }

  const modelRatio = mode === 'official'
    ? Number(model.official_model_ratio ?? model.model_ratio ?? 0)
    : Number(model.model_ratio ?? 0)
  const r = mode === 'site' ? ratio : 1
  const base = modelRatio * 2 * r

  if (type === 'input') {
    return formatCurrencyAmount(base, symbol)
  }
  if (type === 'output') {
    const multiplier = Number(model.completion_ratio || 1)
    return formatCurrencyAmount(base * multiplier, symbol)
  }
  if (type === 'cache_create') {
    const createRatio = model.create_cache_ratio
    if (createRatio == null) return '-'
    return formatCurrencyAmount(base * Number(createRatio), symbol)
  }
  if (type === 'cache_read') {
    const cacheRatio = model.cache_ratio
    if (cacheRatio == null) return '-'
    return formatCurrencyAmount(base * Number(cacheRatio), symbol)
  }
  return '-'
}

function fixedBillingUnitLabel(model: FrontendModel, t: (key: string) => string): string {
  if (model.billing_unit === 'image') return t('per image')
  if (model.billing_unit === 'second') return t('per second')
  return t('per request')
}

function formatFixedPrice(model: FrontendModel, mode: PriceMode, ratio: number, symbol: '$' | '¥'): string {
  const modelPrice = mode === 'official'
    ? Number(model.official_model_price ?? model.model_price ?? 0)
    : Number(model.model_price ?? 0)
  const r = mode === 'site' ? ratio : 1
  return formatCurrencyAmount(modelPrice * r, symbol)
}

function isFixedUnitModel(model: FrontendModel): boolean {
  return model.quota_type === 1 || model.billing_unit === 'image' || model.billing_unit === 'second'
}

type TierPriceField = {
  field: 'inputPrice' | 'outputPrice' | 'cacheReadPrice' | 'cacheCreatePrice'
  labelKey: string
  tone?: 'green' | 'amber'
}

const TIER_PRICE_FIELDS: TierPriceField[] = [
  { field: 'inputPrice', labelKey: 'Input' },
  { field: 'outputPrice', labelKey: 'Output' },
  { field: 'cacheReadPrice', labelKey: 'Cache Read', tone: 'green' },
  { field: 'cacheCreatePrice', labelKey: 'Cache Write', tone: 'amber' },
]

function getDynamicTiers(model: FrontendModel): ParsedTier[] {
  if (model.billing_mode !== 'tiered_expr' || !model.billing_expr) return []
  const { billingExpr } = splitBillingExprAndRequestRules(model.billing_expr)
  return parseTiersFromExpr(billingExpr)
}

type CardPriceColumn = {
  key: string
  labelKey: string
  official: string
  site: string
  tone?: 'green' | 'amber'
}

function cardPriceColumns(
  model: FrontendModel,
  tier: ParsedTier | undefined,
  ratio: number,
  t: (key: string) => string
): CardPriceColumn[] {
  if (isFixedUnitModel(model)) {
    const unit = fixedBillingUnitLabel(model, t)
    return [
      {
        key: 'price',
        labelKey: 'Price',
        official: `${formatFixedPrice(model, 'official', ratio, '$')} / ${unit}`,
        site: `${formatFixedPrice(model, 'site', ratio, '¥')} / ${unit}`,
      },
    ]
  }

  if (tier) {
    return TIER_PRICE_FIELDS.map((item) => {
      const value = Number(tier[item.field] ?? 0)
      const hasValue = Number.isFinite(value) && value > 0
      return {
        key: item.field,
        labelKey: item.labelKey,
        official: hasValue ? `${formatCurrencyAmount(value, '$')}/M` : '-',
        site: hasValue ? `${formatCurrencyAmount(value * ratio, '¥')}/M` : '-',
        tone: item.tone,
      }
    })
  }

  const fields: Array<{
    key: 'input' | 'output' | 'cache_read' | 'cache_create'
    labelKey: string
    tone?: 'green' | 'amber'
  }> = [
    { key: 'input', labelKey: 'Input' },
    { key: 'output', labelKey: 'Output' },
    { key: 'cache_read', labelKey: 'Cache Read', tone: 'green' },
    { key: 'cache_create', labelKey: 'Cache Write', tone: 'amber' },
  ]

  return fields.map((field) => {
    const official = formatPrice(model, field.key, 'official', ratio, t, '$')
    const site = formatPrice(model, field.key, 'site', ratio, t, '¥')
    return {
      key: field.key,
      labelKey: field.labelKey,
      official: official === '-' ? '-' : `${official}/M`,
      site: site === '-' ? '-' : `${site}/M`,
      tone: field.tone,
    }
  })
}

function tierConditionLabel(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (value >= 1_000_000) {
    const n = value / 1_000_000
    return `${Number.isInteger(n) ? n : n.toFixed(1)}M`
  }
  if (value >= 1000) {
    const n = value / 1000
    return `${Number.isInteger(n) ? n : n.toFixed(1)}K`
  }
  return String(value)
}

function tierConditionsSummary(
  conditions: TierCondition[],
  t: (key: string) => string
): string {
  if (!conditions.length) return t('Default')
  const varLabel: Record<TierCondition['var'], string> = {
    p: t('Input'),
    c: t('Output'),
    len: t('Length'),
  }
  const opLabel: Record<TierCondition['op'], string> = {
    '<': '<',
    '<=': '≤',
    '>': '>',
    '>=': '≥',
  }
  return conditions
    .map((c) => `${varLabel[c.var]} ${opLabel[c.op] ?? c.op} ${tierConditionLabel(c.value)}`)
    .join(' && ')
}

function tierGridColumns(count: number): string {
  const priceCols = count > 0 ? `repeat(${count}, 90px)` : '90px'
  return `84px 126px ${priceCols}`
}

function rowKey(row: Pick<ModelRow, 'model' | 'group'>): string {
  return `${row.model.model_name}-${row.group}`
}

export function ModelSquare() {
  const { t, i18n } = useTranslation()
  const uiLang = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('zh') ? 'zh' : 'en'
  // 描述支持三语：管理员可填 JSON {"zh":"...","en":"...","ru":"..."}，按当前语言显示；纯文本原样返回
  const pickDesc = (text?: string) => {
    if (!text) return ''
    const s = text.trim()
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const o = JSON.parse(s) as Record<string, string>
        if (o && typeof o === 'object') {
          return o[uiLang] || o.en || o.zh || Object.values(o)[0] || ''
        }
      } catch {
        /* not JSON, fall through */
      }
    }
    return text
  }
  // 标签显示翻译：命中固定 5 标签则按语言显示，否则原样
  const tagLabel = (tag: string) => {
    const key = TAG_I18N_KEY[tag] ?? TAG_I18N_KEY[tag.trim().toLowerCase()]
    return key ? t(key) : tag
  }
  const [searchValue, setSearchValue] = useState('')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [tierSelection, setTierSelection] = useState<Record<string, string>>({})
  const [selectedModel, setSelectedModel] = useState<ModelRow | null>(null)

  const { data: payload, isLoading } = useQuery({
    queryKey: ['portal-frontend-models'],
    queryFn: getFrontendModels,
    staleTime: 60_000,
  })

  const models = payload?.models ?? []
  const topLevelGroupRatio = payload?.group_ratio ?? {}

  const vendors = useMemo(() => {
    const all = payload?.vendors ?? []
    const vendorNamesWithModels = new Set(models.map((m) => m.vendor_name).filter(Boolean))
    return all.filter((v) => vendorNamesWithModels.has(v.name))
  }, [payload?.vendors, models])

  const vendorIconMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of payload?.vendors ?? []) {
      if (v.icon) map.set(v.name, v.icon)
    }
    return map
  }, [payload?.vendors])
  const vendorFilterLabel =
    vendorFilter === 'all' ? t('portal.page.models.allVendors') : vendorFilter

  // 只展示存在于当前模型集合中的类型
  const availableCategories = useMemo(() => {
    const present = new Set<string>()
    for (const m of models) {
      const tags = parseModelTags(m.tags).visibleTags.map((x) => x.toLowerCase())
      for (const c of FILTER_CATEGORIES) {
        if (c.aliases.some((a) => tags.includes(a))) present.add(c.key)
      }
    }
    return FILTER_CATEGORIES.filter((c) => present.has(c.key))
  }, [models])

  // 单组模式：每个模型一张卡片，分组/倍率取第一个可用分组
  const rows = useMemo(() => {
    let filtered = models
    if (searchValue) {
      const q = searchValue.toLowerCase()
      filtered = filtered.filter((m) =>
        m.model_name.toLowerCase().includes(q) ||
        (pickDesc(m.description) ?? '').toLowerCase().includes(q) ||
        (m.vendor_name ?? '').toLowerCase().includes(q)
      )
    }
    if (vendorFilter !== 'all') {
      filtered = filtered.filter((m) => m.vendor_name === vendorFilter)
    }
    if (tagFilter !== 'all') {
      const cat = FILTER_CATEGORIES.find((c) => c.key === tagFilter)
      if (cat) {
        filtered = filtered.filter((m) => {
          const tags = parseModelTags(m.tags).visibleTags.map((x) => x.toLowerCase())
          return cat.aliases.some((a) => tags.includes(a))
        })
      }
    }

    // 模型广场顺序：#N 升序，无 #N（默认9999）排后；同序按名称稳定排序，避免每次刷新乱跳
    const sorted = [...filtered].sort((a, b) => {
      const oa = parseModelTags(a.tags).squareOrder
      const ob = parseModelTags(b.tags).squareOrder
      return oa - ob || a.model_name.localeCompare(b.model_name)
    })

    return sorted.map((model) => {
      const group = (model.enable_groups ?? [])[0] ?? ''
      const ratio = group
        ? (topLevelGroupRatio[group] ?? model.group_ratio?.[group] ?? 1)
        : 1
      return { model, group, ratio }
    })
  }, [models, searchValue, vendorFilter, tagFilter, topLevelGroupRatio, uiLang])

  const selectedKey = selectedModel ? rowKey(selectedModel) : ''
  const selectedDynamicTiers = selectedModel ? getDynamicTiers(selectedModel.model) : []
  const selectedActiveTier =
    selectedDynamicTiers.find((tier) => tier.label === tierSelection[selectedKey]) ??
    selectedDynamicTiers[0]
  const selectedTierFields = TIER_PRICE_FIELDS.filter((field) =>
    selectedDynamicTiers.some((tier) => {
      const value = Number(tier[field.field] ?? 0)
      return Number.isFinite(value) && value > 0
    })
  )

  return (
    <div className="space-y-5">
      {/* Header (centered) */}
      <div className="pt-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('portal.page.models.title')}</h1>
        <p className="mt-2 text-sm text-gray-400">
          {t('portal.page.models.publicCount', { count: rows.length })}
        </p>
      </div>

      {/* Search (centered) */}
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={t('portal.page.models.searchPlaceholder')}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>
      </div>

      {/* Filters: 标签点选(仅显示存在的标签) + 供应商下拉(仅显示存在的供应商) */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[{ key: 'all', i18n: '' }, ...availableCategories].map((cat) => {
          const Icon = cat.key === 'all' ? null : CAT_ICON[cat.key as keyof typeof CAT_ICON]
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setTagFilter(cat.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                tagFilter === cat.key
                  ? 'border-sky-500 bg-sky-50 text-sky-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {cat.key === 'all' ? t('All Tags') : t(cat.i18n)}
            </button>
          )
        })}
        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger
            size="default"
            className="h-10 min-w-44 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 focus:border-sky-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
          >
            <SelectValue>{vendorFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent
            align="end"
            alignItemWithTrigger={false}
            className="z-[120] max-h-72 min-w-44 border border-gray-200 bg-white text-gray-700 shadow-xl dark:border-white/10 dark:bg-[#171728] dark:text-white"
          >
            <SelectItem value="all">
              {t('portal.page.models.allVendors')}
            </SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.name}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Card Grid */}
      {isLoading ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-500">{t('portal.page.models.loading')}</p>
        </div>
      ) : rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const { model, ratio } = row
            const parsed = parseModelTags(model.tags)
            const key = rowKey(row)
            const dynamicTiers = getDynamicTiers(model)
            const activeTier =
              dynamicTiers.find((tier) => tier.label === tierSelection[key]) ??
              dynamicTiers[0]
            const priceColumns = cardPriceColumns(model, activeTier, ratio, t)

            return (
              <div
                key={key}
                onClick={() => setSelectedModel(row)}
                className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition hover:border-sky-400/30 hover:shadow-sm"
              >
                <ModelBadges badges={parsed.badges} />
                {/* Row 1: Icon + Name + Modality badge + Copy */}
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-50">
                    {getLobeIcon(model.icon || vendorIconMap.get(model.vendor_name ?? ''), 18)}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 line-clamp-1">{model.model_name}</h3>
                  {/* Modality badge - small icon with shadow like OpenRouter */}
                  {parsed.inputModalities.length || parsed.outputModalities.length ? (
                    <ModelModalities input={parsed.inputModalities} output={parsed.outputModalities} />
                  ) : (
                    <ModelModalityBadge modelName={model.model_name} tags={model.tags} />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigator.clipboard.writeText(model.model_name)
                      toast.success(t('Copied'))
                    }}
                    className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-500"
                    title={t('Copy model name')}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Row 2: Description */}
                <p className="mb-3 text-xs leading-relaxed text-gray-500 line-clamp-2">
                  {pickDesc(model.description) || t('No description available')}
                </p>

                {/* Row 3: Dynamic pricing tabs */}
                {dynamicTiers.length > 1 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {dynamicTiers.map((tier) => {
                      const active = activeTier?.label === tier.label
                      return (
                        <button
                          key={tier.label}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setTierSelection((prev) => ({ ...prev, [key]: tier.label }))
                          }}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                            active
                              ? 'border-sky-400 bg-sky-50 text-sky-700'
                              : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                          }`}
                          title={tierConditionsSummary(tier.conditions, t)}
                        >
                          {tier.label || t('Default')}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Row 4: Price cards */}
                <div className="mx-1 text-xs">
                  <div className={`grid gap-2 ${priceColumns.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {priceColumns.map((column) => {
                      const cls =
                        column.tone === 'green'
                          ? 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700'
                          : column.tone === 'amber'
                            ? 'border-amber-200/70 bg-amber-50/80 text-amber-700'
                            : 'border-gray-200 bg-gray-50 text-gray-900'
                      const official =
                        column.official === '-'
                          ? '-'
                          : `${t('portal.page.models.officialPrice')}: ${column.official}`
                      return (
                        <div
                          key={column.key}
                          className={`rounded-lg border p-2.5 shadow-sm ${cls}`}
                        >
                          <div className="text-[11px] font-medium uppercase text-current/60">
                            {t(column.labelKey)}
                          </div>
                          <div className="mt-1 break-words text-lg font-semibold leading-tight text-current">
                            {column.site}
                          </div>
                          <div className="mt-1 truncate text-[11px] text-gray-400 line-through">
                            {official}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Row 5: Tags */}
                {(() => {
                  const cardTags = parsed.visibleTags
                  if (cardTags.length === 0) return null
                  return (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {cardTags.map((tg) => (
                        <span key={tg} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                          {tagLabel(tg)}
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200">
          <p className="text-sm text-gray-400">{t('portal.page.models.noModelsFound')}</p>
        </div>
      )}

      {/* Model Detail — Side Panel (newapi style) */}
      {selectedModel && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedModel(null)}>
          <div className="flex-1 bg-black/30" />
          <div
            className="relative h-full w-full max-w-[820px] overflow-y-auto border-l border-gray-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedModel(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-50">
                {getLobeIcon(selectedModel.model.icon || vendorIconMap.get(selectedModel.model.vendor_name ?? ''), 32)}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{selectedModel.model.model_name}</h2>
                <p className="mt-1 text-sm text-gray-500">{selectedModel.model.vendor_name}</p>
              </div>
            </div>

            {/* Basic Info Section */}
            <div className="mb-6 rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600">ℹ</span>
                <h3 className="text-sm font-semibold text-gray-900">{t('Basic Info')}</h3>
              </div>
              <p className="text-sm text-gray-500">
                {pickDesc(selectedModel.model.description) || t('No model description available')}
              </p>
            </div>

            {/* API Endpoint Section */}
            <div className="mb-6 rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-green-600">⚡</span>
                <h3 className="text-sm font-semibold text-gray-900">{t('API Endpoint')}</h3>
              </div>
              <p className="mb-3 text-xs text-gray-400">{t('Supported endpoint types for this model')}</p>
              {(() => {
                const epMap = (payload?.supported_endpoint ?? {}) as Record<
                  string,
                  { path?: string; method?: string }
                >
                const types = selectedModel.model.supported_endpoint_types ?? []
                const eps = types.map((type) => {
                  const info = epMap[type] || {}
                  const path = (info.path || '').replace(
                    /\{model\}/g,
                    selectedModel.model.model_name || ''
                  )
                  return { type, path, method: info.method || 'POST' }
                })
                return eps.map((ep) => (
                  <div key={ep.type} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-400" />
                      <span className="text-gray-700">
                        {ep.type}
                        {ep.path && (
                          <span className="ml-2 font-mono text-gray-500">{ep.path}</span>
                        )}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{ep.method}</span>
                  </div>
                ))
              })()}
            </div>

            {/* Pricing Section */}
            <div className="mb-6 rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-orange-600">💰</span>
                <h3 className="text-sm font-semibold text-gray-900">{t('Pricing')}</h3>
              </div>

              {selectedDynamicTiers.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-600">
                      {t('Dynamic Pricing')}
                    </span>
                    <span className="text-gray-400">
                      {t('portal.page.models.sitePrice')} · {t('Per 1M tokens')}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="w-max min-w-[600px] overflow-hidden rounded-lg border border-gray-200">
                      <div
                        className="grid gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-400"
                        style={{
                          gridTemplateColumns: tierGridColumns(selectedTierFields.length),
                        }}
                      >
                        <div>{t('Tier')}</div>
                        <div>{t('Conditions')}</div>
                        {selectedTierFields.map((field) => (
                          <div key={field.field} className="text-right">
                            {t(field.labelKey)}
                          </div>
                        ))}
                      </div>
                      <div className="divide-y divide-gray-100">
                        {selectedDynamicTiers.map((tier) => {
                          const active = selectedActiveTier?.label === tier.label
                          return (
                            <div
                              key={`detail-tier-row-${tier.label}`}
                              className={`grid gap-1.5 px-3 py-3 ${active ? 'bg-sky-50/70' : 'bg-white'}`}
                              style={{
                                gridTemplateColumns: tierGridColumns(selectedTierFields.length),
                              }}
                            >
                              <div className="pt-0.5">
                                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                                  {tier.label || t('Default')}
                                </span>
                              </div>
                              <div className="text-xs leading-5 text-gray-500">
                                {tierConditionsSummary(tier.conditions, t)}
                              </div>
                              {selectedTierFields.map((field) => {
                                const value = Number(tier[field.field] ?? 0)
                                const cls =
                                  field.tone === 'green'
                                    ? 'text-emerald-600'
                                    : field.tone === 'amber'
                                      ? 'text-amber-600'
                                      : 'text-gray-900'
                                return (
                                  <div key={field.field} className={`text-right font-mono text-xs font-semibold ${cls}`}>
                                    {value > 0 ? formatCurrencyAmount(value * selectedModel.ratio, '¥') : '-'}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400">
                      <th className="pb-2 text-left font-medium">{t('Billing Type')}</th>
                      <th className="pb-2 text-right font-medium">{t('Price')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-50">
                      <td className="py-2">
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs text-sky-600">{t('Token-based')}</span>
                      </td>
                      <td className="py-2 text-right">
                        {isFixedUnitModel(selectedModel.model) ? (
                          <div className="text-xs">
                            <span className="font-semibold text-gray-900">
                              {formatFixedPrice(selectedModel.model, 'site', selectedModel.ratio, '¥')}
                            </span>
                            <span className="text-gray-400"> / {fixedBillingUnitLabel(selectedModel.model, t)}</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-xs">
                              <span className="font-semibold text-gray-900">{t('Input')} {formatPrice(selectedModel.model, 'input', 'site', selectedModel.ratio, t, '¥')}</span>
                              <span className="text-gray-400"> / {t('Per 1M tokens')}</span>
                            </div>
                            <div className="text-xs">
                              <span className="font-semibold text-gray-900">{t('Output')} {formatPrice(selectedModel.model, 'output', 'site', selectedModel.ratio, t, '¥')}</span>
                              <span className="text-gray-400"> / {t('Per 1M tokens')}</span>
                            </div>
                            {formatPrice(selectedModel.model, 'cache_read', 'site', selectedModel.ratio, t, '¥') !== '-' && (
                              <div className="text-xs">
                                <span className="font-semibold text-green-600">{t('Cache Read')} {formatPrice(selectedModel.model, 'cache_read', 'site', selectedModel.ratio, t, '¥')}</span>
                                <span className="text-gray-400"> / {t('Per 1M tokens')}</span>
                              </div>
                            )}
                            {formatPrice(selectedModel.model, 'cache_create', 'site', selectedModel.ratio, t, '¥') !== '-' && (
                              <div className="text-xs">
                                <span className="font-semibold text-amber-600">{t('Cache Create')} {formatPrice(selectedModel.model, 'cache_create', 'site', selectedModel.ratio, t, '¥')}</span>
                                <span className="text-gray-400"> / {t('Per 1M tokens')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Link
                to="/portal/chat"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                <MessageSquare className="h-4 w-4" />
                {t('Online Experience')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
