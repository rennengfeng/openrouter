import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Wallet, Activity, Zap, Gauge, PieChart, DollarSign, BarChart3, Coins, Hash, Timer, Cpu, Send } from 'lucide-react'
import { VChart } from '@visactor/react-vchart'
import { useAuthStore } from '@/stores/auth-store'
import { formatQuota, formatNumber } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { ModelsChartPreferences } from '@/features/dashboard/components/models/models-chart-preferences'
import { ModelsFilter } from '@/features/dashboard/components/models/models-filter-dialog'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import {
  buildDefaultDashboardFilters,
  buildQueryParams,
  calculateDashboardStats,
  getDefaultDays,
  getSavedChartPreferences,
  saveChartPreferences,
} from '@/features/dashboard/lib'
import type {
  DashboardChartPreferences,
  DashboardFilters,
  QuotaDataItem,
} from '@/features/dashboard/types'

const CHART_CONFIG = { mode: 'desktop-browser' as const }

// 基础暗色样式（不含 title/legends，避免覆盖各 spec 自带的文本/交互配置）
const DARK_THEME_BASE = {
  background: 'transparent',
  axes: [
    { orient: 'bottom' as const, label: { style: { fill: 'hsl(var(--muted-foreground))' } }, grid: { style: { stroke: 'transparent' } } },
    { orient: 'left' as const, label: { style: { fill: 'hsl(var(--muted-foreground))' } }, grid: { style: { stroke: 'transparent' } } },
  ],
}
// 可复用的标题/图例暗色样式片段，按需并入各 spec 的 title/legends
const DARK_TITLE_STYLE = { textStyle: { fill: 'hsl(var(--foreground))' }, subtextStyle: { fill: 'hsl(var(--muted-foreground))' } }
const DARK_LEGEND_ITEM = { shape: { style: { symbolType: 'circle' as const } }, label: { style: { fill: 'hsl(var(--foreground))' } } }


// Curated, vivid-but-tasteful palette inspired by design-seeds / colorhunt —
// fresh and bright (turquoise, coral, sky blue, green, golden), NOT dusty or
// dark. The chart sits on a near-white card (not pure white), so colors don't
// need to be deepened to stay visible; brighter reads cleaner and livelier.
// Still avoids garish pure red / electric blue / deep violet.
//
// Order is deliberate. The FIRST 10 are a hand-picked "hero" set: warm/cool
// alternate and the hue is well-spaced, so the common case (a handful of models)
// always looks like a balanced, designed palette and adjacent pie slices stay
// distinct. Entries 11+ extend it for installs with many models. No per-model
// hardcoding — each model just takes the next color in this fixed order as it
// first appears, so new models are themed automatically without touching code.
const CHART_PALETTE = [
  // ── Hero set (1–10): vivid, distinct, the colors most users will see ──
  '#2fb89a', //  1 turquoise green
  '#f59140', //  2 coral orange
  '#5b9bd5', //  3 sky blue
  '#b9c94a', //  4 lime
  '#d97ab8', //  5 orchid pink
  '#33b9c4', //  6 cyan
  '#ef6f5e', //  7 coral red
  '#7b86d6', //  8 periwinkle
  '#6cc06a', //  9 fresh green
  '#f4be3e', // 10 golden yellow
  // ── Extended set (11–50): same fresh, bright register ──
  '#4cb3a0', // 11 teal
  '#f0a35a', // 12 apricot
  '#6f9be0', // 13 cornflower
  '#9cc35e', // 14 yellow-green
  '#e08ab0', // 15 pink
  '#45c0bf', // 16 aqua
  '#ef8268', // 17 salmon
  '#8f8ad6', // 18 lavender blue
  '#5cbf80', // 19 green
  '#f0c94a', // 20 yellow
  '#c77fc4', // 21 orchid
  '#f59668', // 22 coral
  '#3fb4a8', // 23 sea teal
  '#e8b14a', // 24 gold
  '#6fa8e0', // 25 light blue
  '#db7fa0', // 26 rose
  '#84c45e', // 27 leaf green
  '#54b6c8', // 28 blue cyan
  '#f0a04e', // 29 orange
  '#b98ad0', // 30 soft purple
  '#ee7a5e', // 31 coral
  '#5cb0d0', // 32 sky
  '#a8c850', // 33 lime green
  '#e58fb0', // 34 pink rose
  '#3fbf9c', // 35 mint teal
  '#f5a83f', // 36 amber
  '#7f93da', // 37 indigo blue
  '#ef9678', // 38 peach coral
  '#62c08f', // 39 seafoam
  '#e6c24a', // 40 honey
  '#cf86c0', // 41 magenta orchid
  '#f08a52', // 42 tangerine
  '#49b6b0', // 43 teal
  '#d9a04a', // 44 ochre gold
  '#6bb0e0', // 45 sky blue
  '#d98aa0', // 46 dusty rose
  '#92c85e', // 47 green
  '#58aec0', // 48 cyan blue
  '#f0b15a', // 49 marigold
  '#9b88d4', // 50 violet blue
]

const sessionColorMap = new Map<string, string>()

function modelToColor(name: string): string {
  if (sessionColorMap.has(name)) return sessionColorMap.get(name)!
  const color = CHART_PALETTE[sessionColorMap.size % CHART_PALETTE.length]
  sessionColorMap.set(name, color)
  return color
}

function renderCompactNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 10000) return (num / 1000).toFixed(1) + 'k'
  return String(num)
}

function Sparkline({ data, color, width = 80, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height * 0.8) - height * 0.1
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const SPARKLINE_BUCKETS = 8

function buildTrendBuckets(data: QuotaDataItem[], startTs: number, endTs: number) {
  const quotaBuckets = Array.from({ length: SPARKLINE_BUCKETS }, () => 0)
  const tokenBuckets = Array.from({ length: SPARKLINE_BUCKETS }, () => 0)
  const countBuckets = Array.from({ length: SPARKLINE_BUCKETS }, () => 0)

  const range = endTs - startTs || 1
  for (const item of data) {
    const ts = Number(item.created_at) || startTs
    const idx = Math.min(SPARKLINE_BUCKETS - 1, Math.max(0, Math.floor(((ts - startTs) / range) * SPARKLINE_BUCKETS)))
    quotaBuckets[idx] += Number(item.quota) || 0
    tokenBuckets[idx] += Number(item.token_used) || 0
    countBuckets[idx] += Number(item.count) || 0
  }

  return { quotaBuckets, tokenBuckets, countBuckets }
}

const TIME_INTERVALS_SEC: Record<string, number> = {
  hour: 3600,
  day: 86400,
  week: 604800,
}

function timestamp2label(ts: number, granularity: string, showYear: boolean): string {
  const date = new Date(ts * 1000)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  let str = showYear ? `${y}-${m}-${d}` : `${m}-${d}`
  if (granularity === 'hour') {
    str += ` ${h}:00`
  } else if (granularity === 'week') {
    const next = new Date(ts * 1000 + 6 * 86400000)
    const nm = String(next.getMonth() + 1).padStart(2, '0')
    const nd = String(next.getDate()).padStart(2, '0')
    const nextStr = showYear ? `${next.getFullYear()}-${nm}-${nd}` : `${nm}-${nd}`
    str += ` - ${nextStr}`
  }
  return str
}

function isDataCrossYear(timestamps: number[]): boolean {
  if (!timestamps || timestamps.length === 0) return false
  const years = new Set(timestamps.map((ts) => new Date(ts * 1000).getFullYear()))
  return years.size > 1
}

interface ChartData {
  pieData: Array<{ type: string; value: number }>
  barData: Array<{ Time: string; Model: string; Usage: number; rawQuota: number; TimeSum: number }>
  lineData: Array<{ Time: string; Model: string; Count: number }>
  rankData: Array<{ Model: string; Count: number }>
  modelColors: Record<string, string>
  totalQuota: number
  totalTimes: number
}

function processChartData(data: QuotaDataItem[], granularity: string, otherLabel: string): ChartData {
  const uniqueModels = new Set<string>()
  let totalQuota = 0
  let totalTimes = 0

  const showYear = isDataCrossYear(data.map((item) => Number(item.created_at)))

  data.forEach((item) => {
    uniqueModels.add(item.model_name ?? '')
    totalQuota += Number(item.quota) || 0
    totalTimes += Number(item.count) || 0
  })

  const aggregatedData = new Map<string, { time: string; model: string; quota: number; count: number }>()
  data.forEach((item) => {
    const timeKey = timestamp2label(Number(item.created_at), granularity, showYear)
    const key = `${timeKey}-${item.model_name}`
    if (!aggregatedData.has(key)) {
      aggregatedData.set(key, { time: timeKey, model: item.model_name ?? '', quota: 0, count: 0 })
    }
    const existing = aggregatedData.get(key)!
    existing.quota += Number(item.quota) || 0
    existing.count += Number(item.count) || 0
  })

  const modelTotals = new Map<string, number>()
  for (const [, value] of aggregatedData) {
    modelTotals.set(value.model, (modelTotals.get(value.model) || 0) + value.count)
  }

  const pieData = Array.from(modelTotals)
    .map(([model, count]) => ({ type: model, value: count }))
    .sort((a, b) => b.value - a.value)

  let chartTimePoints = Array.from(new Set([...aggregatedData.values()].map((d) => d.time)))
  if (chartTimePoints.length < 7 && data.length > 0) {
    const lastTime = Math.max(...data.map((item) => Number(item.created_at)))
    const interval = TIME_INTERVALS_SEC[granularity] || 3600
    const generatedTimestamps = Array.from({ length: 7 }, (_, i) => lastTime - (6 - i) * interval)
    const genShowYear = isDataCrossYear(generatedTimestamps)
    chartTimePoints = generatedTimestamps.map((ts) => timestamp2label(ts, granularity, genShowYear))
  }

  const barData: ChartData['barData'] = []
  chartTimePoints.forEach((time) => {
    let timeData = Array.from(uniqueModels).map((model) => {
      const key = `${time}-${model}`
      const aggregated = aggregatedData.get(key)
      return {
        Time: time,
        Model: model,
        rawQuota: aggregated?.quota || 0,
        Usage: aggregated?.quota || 0,
        TimeSum: 0,
      }
    })
    const timeSum = timeData.reduce((sum, item) => sum + item.rawQuota, 0)
    timeData = timeData.map((item) => ({ ...item, TimeSum: timeSum }))
    barData.push(...timeData)
  })
  barData.sort((a, b) => a.Time.localeCompare(b.Time))

  const lineData: ChartData['lineData'] = []
  chartTimePoints.forEach((time) => {
    Array.from(uniqueModels).forEach((model) => {
      const key = `${time}-${model}`
      const aggregated = aggregatedData.get(key)
      lineData.push({ Time: time, Model: model, Count: aggregated?.count || 0 })
    })
  })
  lineData.sort((a, b) => a.Time.localeCompare(b.Time))

  const MAX_RANK = 20
  const allRank = Array.from(modelTotals)
    .map(([model, count]) => ({ Model: model, Count: count }))
    .sort((a, b) => b.Count - a.Count)
  let rankData: ChartData['rankData']
  if (allRank.length > MAX_RANK) {
    const top = allRank.slice(0, MAX_RANK)
    const otherCount = allRank.slice(MAX_RANK).reduce((s, i) => s + i.Count, 0)
    rankData = [...top, { Model: otherLabel, Count: otherCount }]
  } else {
    rankData = allRank
  }

  const modelColors: Record<string, string> = {}
  uniqueModels.forEach((m) => { modelColors[m] = modelToColor(m) })

  return { pieData, barData, lineData, rankData, modelColors, totalQuota, totalTimes }
}

const TABS = [
  { key: '1', label: 'Consumption Distribution' },
  { key: '2', label: 'Call Trend' },
  { key: '3', label: 'Call Count Distribution' },
  { key: '4', label: 'Call Count Ranking' },
]

export function PortalDataBoard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const [modelData, setModelData] = useState<QuotaDataItem[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [chartPreferences, setChartPreferences] =
    useState<DashboardChartPreferences>(() => getSavedChartPreferences())
  const [modelFilters, setModelFilters] = useState<DashboardFilters>(() =>
    buildDefaultDashboardFilters(getSavedChartPreferences())
  )
  const [stats, setStats] = useState<{ totalQuota: number; totalCount: number; totalTokens: number } | null>(null)
  const [timeRangeMinutes, setTimeRangeMinutes] = useState(0)
  const [activeChartTab, setActiveChartTab] = useState('1')

  useEffect(() => {
    const abortController = new AbortController()
    setDataLoading(true)

    const timeRange = computeTimeRange(
      getDefaultDays(modelFilters?.time_granularity),
      modelFilters?.start_timestamp,
      modelFilters?.end_timestamp
    )
    const timeDiff = (timeRange.end_timestamp - timeRange.start_timestamp) / 60
    setTimeRangeMinutes(timeDiff)

    getUserQuotaDates(buildQueryParams(timeRange, modelFilters), false)
      .then((res) => {
        if (abortController.signal.aborted) return
        const data = res?.data || []
        setStats(calculateDashboardStats(data))
        setModelData(data)
      })
      .catch(() => {
        if (abortController.signal.aborted) return
        setStats(null)
        setModelData([])
      })
      .finally(() => {
        if (!abortController.signal.aborted) setDataLoading(false)
      })

    return () => { abortController.abort() }
  }, [modelFilters])

  const handleFilterChange = useCallback((filters: DashboardFilters) => {
    setModelFilters(filters)
  }, [])

  const handleResetFilters = useCallback(() => {
    setModelFilters(buildDefaultDashboardFilters(chartPreferences))
  }, [chartPreferences])

  const handleChartPreferencesChange = useCallback(
    (preferences: DashboardChartPreferences) => {
      setChartPreferences(preferences)
      setModelFilters(buildDefaultDashboardFilters(preferences))
      saveChartPreferences(preferences)
    },
    []
  )

  const timeRange = useMemo(() => computeTimeRange(
    getDefaultDays(modelFilters?.time_granularity),
    modelFilters?.start_timestamp,
    modelFilters?.end_timestamp
  ), [modelFilters])

  const trendBuckets = useMemo(() =>
    buildTrendBuckets(modelData, timeRange.start_timestamp, timeRange.end_timestamp),
    [modelData, timeRange]
  )

  const granularity = modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY

  const chartData = useMemo(() => processChartData(modelData, granularity, t('Other')), [modelData, granularity, t])

  const safeDivide = (a: number, b: number) => (b === 0 ? 0 : a / b)
  const avgRPM = safeDivide(stats?.totalCount ?? 0, timeRangeMinutes).toFixed(3)
  const avgTPM = safeDivide(stats?.totalTokens ?? 0, timeRangeMinutes).toFixed(3)

  const cardGroups = [
    {
      title: t('Account Data'),
      icon: Wallet,
      items: [
        { label: t('Current Balance'), value: formatQuota(user?.quota ?? 0), color: '#3b82f6', itemIcon: DollarSign },
        { label: t('Total Usage'), value: formatQuota(user?.used_quota ?? 0), color: '#8b5cf6', itemIcon: BarChart3 },
      ],
      trendData: [] as number[],
      trendColor: '#3b82f6',
    },
    {
      title: t('Usage Statistics'),
      icon: Activity,
      items: [
        { label: t('Request Count'), value: formatNumber(user?.request_count ?? 0), color: '#10b981', itemIcon: Send },
        { label: t('Statistical Count'), value: formatNumber(stats?.totalCount ?? 0), color: '#06b6d4', itemIcon: Hash },
      ],
      trendData: trendBuckets.countBuckets,
      trendColor: '#06b6d4',
    },
    {
      title: t('Resource Consumption'),
      icon: Zap,
      items: [
        { label: t('Statistical Quota'), value: formatQuota(stats?.totalQuota ?? 0), color: '#f59e0b', itemIcon: Coins },
        { label: t('Statistical Tokens'), value: formatNumber(stats?.totalTokens ?? 0), color: '#ec4899', itemIcon: Cpu },
      ],
      trendData: trendBuckets.quotaBuckets,
      trendColor: '#f59e0b',
    },
    {
      title: t('Performance Metrics'),
      icon: Gauge,
      items: [
        { label: t('Average RPM'), value: avgRPM, color: '#6366f1', itemIcon: Timer },
        { label: t('Average TPM'), value: avgTPM, color: '#f97316', itemIcon: Activity },
      ],
      trendData: trendBuckets.tokenBuckets,
      trendColor: '#f97316',
    },
  ]

  const specPie = useMemo(() => {
    const hasData = chartData.pieData.length > 0
    return {
      type: 'pie' as const,
      data: [{ id: 'id0', values: hasData ? chartData.pieData : [{ type: t('暂无数据'), value: 1 }] }],
      outerRadius: 0.8,
      innerRadius: 0.5,
      padAngle: 0.6,
      valueField: 'value',
      categoryField: 'type',
      pie: { style: { cornerRadius: 10 }, state: { hover: { outerRadius: 0.85, stroke: '#000', lineWidth: 1 } } },
      title: { visible: true, text: t('Model Call Distribution'), subtext: `${t('Total')}：${renderCompactNumber(chartData.totalTimes)}`, textStyle: { fill: 'hsl(var(--foreground))' }, subtextStyle: { fill: 'hsl(var(--muted-foreground))' } },
      legends: {
        visible: hasData,
        orient: 'left' as const,
        position: 'middle' as const,
        item: { shape: { style: { symbolType: 'circle' } }, label: { style: { fill: 'hsl(var(--foreground))' } } },
        pager: { visible: true },
      },
      label: { visible: hasData },
      tooltip: { mark: { content: [{ key: (datum: any) => datum['type'], value: (datum: any) => renderCompactNumber(datum['value']) }] } },
      color: hasData ? { specified: chartData.modelColors } : { type: 'ordinal' as const, range: ['hsl(var(--muted))'] },
      background: 'transparent',
    }
  }, [chartData, t])

  const specBar = useMemo(() => ({
    type: 'bar' as const,
    data: [{ id: 'barData', values: chartData.barData }],
    xField: 'Time',
    yField: 'Usage',
    seriesField: 'Model',
    stack: true,
    legends: { visible: true, selectMode: 'single' as const, item: DARK_LEGEND_ITEM },
    title: { visible: true, text: t('Model Consumption Distribution'), subtext: `${t('Total')}：${formatQuota(chartData.totalQuota)}`, ...DARK_TITLE_STYLE },
    bar: { state: { hover: { stroke: '#000', lineWidth: 1 } } },
    tooltip: {
      mark: { content: [{ key: (datum: any) => datum['Model'], value: (datum: any) => formatQuota(datum['rawQuota'] || 0) }] },
    },
    color: { specified: chartData.modelColors },
    ...DARK_THEME_BASE,
  }), [chartData, t])

  const specLine = useMemo(() => ({
    type: 'line' as const,
    data: [{ id: 'lineData', values: chartData.lineData }],
    xField: 'Time',
    yField: 'Count',
    seriesField: 'Model',
    legends: { visible: true, selectMode: 'single' as const, item: DARK_LEGEND_ITEM },
    title: { visible: true, text: t('Call Trend'), subtext: `${t('Total')}：${renderCompactNumber(chartData.totalTimes)}`, ...DARK_TITLE_STYLE },
    tooltip: {
      mark: { content: [{ key: (datum: any) => datum['Model'], value: (datum: any) => renderCompactNumber(datum['Count']) }] },
    },
    color: { specified: chartData.modelColors },
    ...DARK_THEME_BASE,
  }), [chartData, t])

  const specRank = useMemo(() => ({
    type: 'bar' as const,
    data: [{ id: 'rankData', values: chartData.rankData }],
    xField: 'Model',
    yField: 'Count',
    seriesField: 'Model',
    legends: { visible: true, selectMode: 'single' as const, item: DARK_LEGEND_ITEM },
    title: { visible: true, text: t('Model Call Ranking'), subtext: `${t('Total')}：${renderCompactNumber(chartData.totalTimes)}`, ...DARK_TITLE_STYLE },
    bar: { state: { hover: { stroke: '#000', lineWidth: 1 } } },
    tooltip: { mark: { content: [{ key: (datum: any) => datum['Model'], value: (datum: any) => renderCompactNumber(datum['Count']) }] } },
    color: { specified: chartData.modelColors },
    ...DARK_THEME_BASE,
  }), [chartData, t])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('portal.page.dashboard.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('portal.page.dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ModelsChartPreferences
            preferences={chartPreferences}
            onPreferencesChange={handleChartPreferencesChange}
          />
          <ModelsFilter
            preferences={chartPreferences}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
          />
        </div>
      </div>

      {/* Classic-style 4 card groups */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cardGroups.map((group) => {
          const Icon = group.icon
          return (
            <div key={group.title} className="overflow-hidden rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span>{group.title}</span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-3">
                  {group.items.map((item) => {
                    const ItemIcon = item.itemIcon
                    return (
                      <div key={item.label} className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: item.color }}
                        >
                          <ItemIcon className="h-4 w-4 text-gray-900" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="truncate font-mono text-base font-bold tabular-nums">{item.value}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {group.trendData.length > 1 && (
                  <Sparkline data={group.trendData} color={group.trendColor} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Classic-style Model Data Analysis with tabs */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PieChart className="h-4 w-4 text-muted-foreground" />
            <span>{t('Model Analytics')}</span>
          </div>
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveChartTab(tab.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  activeChartTab === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>
        </div>
        <div className="h-96 p-2">
          {dataLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <>
              {activeChartTab === '1' && <VChart spec={specBar} option={CHART_CONFIG} />}
              {activeChartTab === '2' && <VChart spec={specLine} option={CHART_CONFIG} />}
              {activeChartTab === '3' && <VChart spec={specPie} option={CHART_CONFIG} />}
              {activeChartTab === '4' && <VChart spec={specRank} option={CHART_CONFIG} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
