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


// Curated, muted palette inspired by design-seeds / colorhunt — teal-led with
// warm earthy accents (clay, ochre, sage, rose, mauve). Avoids garish primary
// red / electric blue / saturated purple, AND avoids pale/pastel tones that
// would wash out on the white chart background — every entry is kept at medium
// depth so it stays visible.
//
// Order is deliberate. The FIRST 10 are a hand-picked "hero" set: well-spaced
// around the hue wheel and maximally distinct, so the common case (a handful of
// models) always looks like a balanced, designed palette. Entries 11+ extend it
// for installs with many models. No per-model hardcoding — each model simply
// takes the next color in this fixed order as it first appears, so new models
// are themed automatically without touching code.
const CHART_PALETTE = [
  // ── Hero set (1–10): balanced, distinct, the colors most users will see ──
  '#3f8e8c', //  1 deep teal
  '#e08a5e', //  2 coral clay
  '#4a6f93', //  3 dusty blue
  '#8aa873', //  4 sage green
  '#e0a94e', //  5 amber gold
  '#a86d8f', //  6 plum rose
  '#5fa39a', //  7 jade teal
  '#d96f68', //  8 terracotta
  '#3d6b63', //  9 pine teal
  '#c79a52', // 10 brass ochre
  // ── Extended set (11–50): same muted, medium-depth register ──
  '#6b8fb0', // 11 slate blue
  '#cf8a6a', // 12 clay tan
  '#7a9e6e', // 13 moss green
  '#b5728f', // 14 dusty mauve-rose
  '#4f9d96', // 15 deep aqua
  '#d98f4e', // 16 ochre orange
  '#5c7a96', // 17 steel blue
  '#c06b6b', // 18 brick rose
  '#6f9e88', // 19 medium seafoam
  '#b89a4e', // 20 olive gold
  '#8f7aa3', // 21 muted lavender-grey
  '#d97f5e', // 22 coral orange
  '#4d8378', // 23 green-teal
  '#c98a5e', // 24 caramel
  '#7090a8', // 25 dusty steel
  '#b56b7e', // 26 rose
  '#6a9c7a', // 27 fern green
  '#5a8a8f', // 28 teal grey
  '#a87d5e', // 29 taupe brown
  '#c47a6a', // 30 light terracotta
  '#5b7d9a', // 31 blue slate
  '#88a86a', // 32 olive sage
  '#b8728a', // 33 mauve pink
  '#50968c', // 34 teal
  '#d9a05e', // 35 sand gold
  '#6d7fa0', // 36 periwinkle slate
  '#c0795e', // 37 rust
  '#7ba890', // 38 medium mint
  '#a99050', // 39 dark brass
  '#9a6d8a', // 40 plum mauve
  '#e0975e', // 41 apricot
  '#4f8a82', // 42 pine
  '#c98a72', // 43 clay rose
  '#6b95a8', // 44 sky slate
  '#b07a5e', // 45 cocoa tan
  '#84a87e', // 46 green sage
  '#bf7f7f', // 47 dusty rose
  '#5e8f96', // 48 teal blue
  '#c9a05e', // 49 honey
  '#7d6f96', // 50 muted indigo-grey
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
