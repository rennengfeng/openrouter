import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'
import { formatQuota } from '@/lib/format'
import { Search, Activity, Zap, Clock, AlertTriangle, Download, RefreshCw, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'

type TimeGranularity = 'hour' | 'day' | 'week'

type LogItem = {
  id: number
  created_at: number
  token_name?: string
  model_name?: string
  quota?: number
  prompt_tokens?: number
  completion_tokens?: number
  channel?: number
  group?: string
  use_time?: number
  request_time?: number
  type?: number
  is_stream?: boolean
  content?: string
  ip?: string
  other?: string
  request_id?: string
}

function parseOther(other?: string): {
  frt?: number
  cache_tokens?: number
  cache_creation_tokens?: number
  cache_creation_tokens_5m?: number
  cache_creation_tokens_1h?: number
  model_ratio?: number
  completion_ratio?: number
  model_price?: number
  cache_ratio?: number
  cache_creation_ratio?: number
  cache_creation_ratio_5m?: number
  group_ratio?: number
  user_group_ratio?: number
  request_path?: string
} | null {
  if (!other) return null
  try {
    const data = JSON.parse(other)
    return {
      frt: data.frt ?? data.first_response_time,
      cache_tokens: data.cache_tokens ?? data.cached_tokens,
      cache_creation_tokens: data.cache_creation_tokens,
      cache_creation_tokens_5m: data.cache_creation_tokens_5m,
      cache_creation_tokens_1h: data.cache_creation_tokens_1h,
      model_ratio: data.model_ratio,
      completion_ratio: data.completion_ratio,
      model_price: data.model_price,
      cache_ratio: data.cache_ratio,
      cache_creation_ratio: data.cache_creation_ratio ?? data.cache_creation_ratio_5m,
      group_ratio: data.group_ratio,
      user_group_ratio: data.user_group_ratio,
      request_path: data.request_path,
    }
  } catch {
    return null
  }
}

export function PortalLogs() {
  const { t } = useTranslation()
  const [startDate, setStartDate] = useState(() => dayjs().subtract(29, 'day').startOf('day'))
  const [endDate, setEndDate] = useState(() => dayjs().endOf('day'))
  const [granularity, setGranularity] = useState<TimeGranularity>('day')

  const [keyFilter, setKeyFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const range = (() => {
    const end = endDate.unix()
    if (granularity === 'hour') {
      return { start: dayjs().subtract(1, 'day').startOf('day').unix(), end }
    }
    if (granularity === 'week') {
      return { start: dayjs().subtract(29, 'day').startOf('day').unix(), end }
    }
    return { start: startDate.unix(), end }
  })()

  const todayStart = dayjs().startOf('day').unix()
  const todayEnd = dayjs().endOf('day').unix()

  const { data: todayStatData } = useQuery({
    queryKey: ['portal-log-today-stat', todayStart, todayEnd],
    queryFn: async () => {
      const res = await api.get('/api/data/self', {
        params: {
          start_timestamp: todayStart,
          end_timestamp: todayEnd,
          default_time: 'hour',
        },
      })
      return res.data?.data as Array<{
        request_count?: number
        count?: number
        token?: number
        token_used?: number
      }> | undefined
    },
    staleTime: 30_000,
  })


  const { data: modelList } = useQuery({
    queryKey: ['portal-log-filter-options', startDate.unix(), endDate.unix()],
    queryFn: async () => {
      // 优先用专用接口（一次拿全量 token/model，不受分页限制）
      try {
        const res = await api.get('/api/log/self/filter-options', {
          params: { start_timestamp: startDate.unix(), end_timestamp: endDate.unix() },
          skipErrorHandler: true,
        } as Record<string, unknown>)
        const payload = res.data?.data as { tokens?: string[]; models?: string[] } | undefined
        if (payload) {
          return {
            tokens: [...(payload.tokens ?? [])].sort(),
            models: [...(payload.models ?? [])].sort(),
          }
        }
      } catch {
        // 后端未部署该接口（404）时，降级为从日志列表去重
      }
      const res = await api.get('/api/log/self', {
        params: { p: 1, size: 100, start_timestamp: startDate.unix(), end_timestamp: endDate.unix() },
      })
      const items = res.data?.data?.items as LogItem[] | undefined
      const modelSet = new Set<string>()
      const tokenSet = new Set<string>()
      for (const item of items ?? []) {
        if (item.model_name) modelSet.add(item.model_name)
        if (item.token_name) tokenSet.add(item.token_name)
      }
      return { models: Array.from(modelSet).sort(), tokens: Array.from(tokenSet).sort() }
    },
    staleTime: 60_000,
  })

  const { data: statData } = useQuery({
    queryKey: ['portal-log-stat', startDate.unix(), endDate.unix(), keyFilter, modelFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        start_timestamp: startDate.unix(),
        end_timestamp: endDate.unix(),
      }
      if (keyFilter) params.token_name = keyFilter
      if (modelFilter) params.model_name = modelFilter
      if (statusFilter && statusFilter !== 'all') params.type = statusFilter === 'success' ? 0 : 1
      const res = await api.get('/api/log/self/stat', { params })
      return res.data?.data as { quota?: number; rpm?: number; tpm?: number } | undefined
    },
    staleTime: 30_000,
  })

  const allTokenOptions = (() => {
    return modelList?.tokens ?? []
  })()

  const tokenDisplayName = (name: string) => /^playground-/i.test(name) ? t('portal.page.logs.playground') : name

  // 后端写入日志的固定中文模板（带金额）做整句翻译；其余英文/技术短语做逐词替换，数字与结构保留。
  const LOG_PHRASES: Array<[RegExp, string]> = [
    [/insufficient[_ ]?user[_ ]?quota/gi, 'portal.page.logs.phrase.insufficientQuota'],
    [/额度不足/g, 'portal.page.logs.phrase.insufficientQuota'],
    [/bad response/gi, 'portal.page.logs.phrase.badResponse'],
    [/status[_ ]code/gi, 'portal.page.logs.phrase.statusCode'],
    [/openai_error/gi, 'portal.page.logs.phrase.openaiError'],
  ]
  const translateLogContent = (content?: string): string => {
    if (!content) return content ?? ''
    const s = content.trim()
    let m: RegExpMatchArray | null
    // 管理员额度操作
    if ((m = s.match(/^管理员增加用户额度\s*(.+?)\s*额度$/))) return t('portal.page.logs.content.adminAddQuota', { amount: m[1] })
    if ((m = s.match(/^管理员减少用户额度\s*(.+?)\s*额度$/))) return t('portal.page.logs.content.adminSubQuota', { amount: m[1] })
    if ((m = s.match(/^管理员将用户额度修改为\s*(.+)$/))) return t('portal.page.logs.content.adminSetQuota', { amount: m[1] })
    // 赠送 / 充值类
    if ((m = s.match(/^用户签到，获得额度\s*(.+)$/))) return t('portal.page.logs.content.checkinReward', { amount: m[1] })
    if ((m = s.match(/^新用户注册赠送\s*(.+)$/))) return t('portal.page.logs.content.registerBonus', { amount: m[1] })
    if ((m = s.match(/^使用邀请码赠送\s*(.+)$/))) return t('portal.page.logs.content.inviteeBonus', { amount: m[1] })
    if ((m = s.match(/^邀请用户赠送\s*(.+)$/))) return t('portal.page.logs.content.inviterBonus', { amount: m[1] })
    if ((m = s.match(/^通过兑换码充值\s*(.+?)，兑换码ID\s*(\d+)$/))) return t('portal.page.logs.content.redeemRecharge', { amount: m[1], id: m[2] })
    if ((m = s.match(/^使用在线充值成功，充值金额[:：]\s*(.+?)，支付金额[:：]\s*(.+)$/))) return t('portal.page.logs.content.onlineTopup', { amount: m[1], paid: m[2] })
    // 两步验证 / 安全验证（无变量）
    if (s === '开始设置两步验证') return t('portal.page.logs.content.twoFaSetup')
    if (s === '成功启用两步验证') return t('portal.page.logs.content.twoFaEnabled')
    if (s === '禁用两步验证') return t('portal.page.logs.content.twoFaDisabled')
    if (s === '重新生成两步验证备用码') return t('portal.page.logs.content.twoFaRegen')
    if ((m = s.match(/^通用安全验证成功\s*\(验证方式:\s*(.+?)\)$/))) return t('portal.page.logs.content.securityVerified', { method: m[1] })
    // 其余：英文/技术短语逐词替换，数字与结构保留
    let out = content
    for (const [re, key] of LOG_PHRASES) out = out.replace(re, t(key))
    return out
  }

  const { data: chartRawData } = useQuery({
    queryKey: ['portal-log-chart-data', range.start, range.end, granularity],
    queryFn: async () => {
      const res = await api.get('/api/data/self', {
        params: {
          start_timestamp: range.start,
          end_timestamp: range.end,
          default_time: granularity,
        },
      })
      return res.data?.data as Array<{
        created_at?: number
        date?: string
        request_count?: number
        count?: number
        quota?: number
        token?: number
        token_used?: number
      }> | undefined
    },
    staleTime: 30_000,
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['portal-logs', startDate.unix(), endDate.unix(), keyFilter, modelFilter, statusFilter, page, pageSize],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        p: page,
        size: pageSize,
        start_timestamp: startDate.unix(),
        end_timestamp: endDate.unix(),
      }
      if (keyFilter) params.token_name = keyFilter
      if (modelFilter) params.model_name = modelFilter
      if (statusFilter && statusFilter !== 'all') params.type = statusFilter === 'success' ? 0 : 1
      const res = await api.get('/api/log/self', { params })
      return res.data?.data as { items?: LogItem[]; total?: number } | undefined
    },
    staleTime: 15_000,
  })

  const logs = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  const totalRequests = todayStatData?.reduce((s, d) => s + (d.request_count ?? d.count ?? 0), 0) ?? 0
  const totalTokens = todayStatData?.reduce((s, d) => s + (d.token ?? d.token_used ?? 0), 0) ?? 0
  const avgTime = (() => {
    if (!logs || logs.length === 0) return 0
    const withTime = logs.filter(l => l.use_time && l.use_time > 0)
    if (withTime.length === 0) return 0
    return Math.round(withTime.reduce((s, l) => s + (l.use_time ?? 0), 0) / withTime.length * 1000)
  })()

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
  }

  const statsCards = [
    { icon: Activity, label: t('portal.page.logs.todayRequests'), value: formatNum(totalRequests), color: 'text-blue-400', dotColor: 'bg-blue-400' },
    { icon: Zap, label: t('portal.page.logs.todayTokens'), value: formatNum(totalTokens), color: 'text-sky-600', dotColor: 'bg-sky-400' },
    { icon: Clock, label: t('portal.page.logs.avgResponseTime'), value: avgTime > 0 ? `${avgTime}ms` : '—', color: 'text-cyan-400', dotColor: 'bg-cyan-400' },
    { icon: AlertTriangle, label: t('portal.page.logs.errorRate'), value: '—', color: 'text-orange-400', dotColor: 'bg-orange-400' },
  ]

  const chartData = (() => {
    if (!chartRawData || chartRawData.length === 0) {
      const result = []
      const now = dayjs()
      if (granularity === 'hour') {
        for (let i = 23; i >= 0; i--) {
          result.push({ date: now.subtract(i, 'hour').format('HH:mm'), requests: 0, errors: 0 })
        }
      } else {
        const days = granularity === 'week' ? 4 : 7
        for (let i = days - 1; i >= 0; i--) {
          result.push({ date: now.subtract(i, granularity === 'week' ? 'week' : 'day').format('MM-DD'), requests: 0, errors: 0 })
        }
      }
      return result
    }
    const grouped: Record<string, { requests: number; errors: number }> = {}
    for (const item of chartRawData) {
      const date = item.date ?? (item.created_at ? dayjs.unix(item.created_at).format('YYYY-MM-DD HH:mm') : '')
      let key: string
      if (granularity === 'hour') {
        key = date.length >= 13 ? date.slice(11, 16) : date.length > 5 ? date.slice(5) : date
      } else {
        key = date.length > 5 ? date.slice(5, 10) : date
      }
      if (!grouped[key]) grouped[key] = { requests: 0, errors: 0 }
      grouped[key].requests += item.request_count ?? item.count ?? 0
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, requests: d.requests, errors: d.errors }))
  })()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('portal.page.logs.title')}</h1>
          <p className="mt-1 text-sm text-gray-400">{t('portal.page.logs.subtitle')}</p>
        </div>
        <CompactDateTimeRangePicker
          start={startDate.toDate()}
          end={endDate.toDate()}
          onChange={({ start, end }) => {
            if (start) setStartDate(dayjs(start))
            if (end) setEndDate(dayjs(end))
            setPage(1)
          }}
          className="w-[320px]"
        />
      </div>

      {/* Stats Cards — full width */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statsCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${card.dotColor}`} />
                <span className="text-xs text-gray-400">{card.label}</span>
              </div>
              <p className="mt-1 text-xl font-bold text-gray-900">{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Chart — full width */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-base font-semibold text-gray-900">{t('portal.page.logs.requestTrend')}</h3>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" />{t('portal.page.logs.requests')}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-300" />{t('portal.page.logs.errors')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {(['hour', 'day', 'week'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    granularity === g ? 'bg-sky-600 text-white shadow' : 'text-gray-500 hover:text-gray-600'
                  }`}
                >
                  {g === 'hour' ? t('portal.page.logs.hour') : g === 'day' ? t('portal.page.logs.day') : t('portal.page.logs.week')}
                </button>
              ))}
            </div>
            <button type="button" className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50" title={t('portal.page.logs.export')}>
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorLogReq2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  />
                  <Area type="monotone" dataKey="requests" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorLogReq2)" name={t('portal.page.logs.requests')} />
                  <Area type="monotone" dataKey="errors" stroke="#d1d5db" strokeWidth={1.5} fill="none" name={t('portal.page.logs.errors')} />
                </AreaChart>
              </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Bar — horizontal, between chart and log list (OpenRouter style) */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div className="flex-1">
          <select
            value={keyFilter}
            onChange={(e) => setKeyFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-sky-400 focus:outline-none"
          >
            <option value="">{t('portal.page.logs.allTokens')}</option>
            {allTokenOptions.map((name) => (
              <option key={name} value={name}>{tokenDisplayName(name)}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-sky-400 focus:outline-none"
          >
            <option value="">{t('portal.page.logs.allModels')}</option>
            {(modelList?.models ?? []).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-sky-400 focus:outline-none"
          >
            <option value="">{t('portal.page.logs.allStatus')}</option>
            <option value="success">{t('portal.page.logs.success')}</option>
            <option value="error">{t('portal.page.logs.failed')}</option>
          </select>
        </div>
        {/* Usage / RPM / TPM */}
        <div className="flex flex-1 items-center justify-center gap-4">
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="h-4 w-1 rounded-full bg-sky-500" />
            <span className="text-gray-500">{t('Usage')}</span>
            <span className="font-mono text-base font-bold text-gray-900">{formatQuota(statData?.quota ?? 0)}</span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="h-4 w-1 rounded-full bg-sky-500" />
            <span className="text-gray-500">RPM</span>
            <span className="font-mono text-base font-bold text-gray-900">{totalRequests}</span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="h-4 w-1 rounded-full bg-cyan-500" />
            <span className="text-gray-500">TPM</span>
            <span className="font-mono text-base font-bold text-gray-900">{formatNum(totalTokens)}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setPage(1); refetch() }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-sky-500"
        >
          <Search className="h-3.5 w-3.5" /> {t('portal.page.logs.searchLogs')}
        </button>
      </div>

      {/* Log Table */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-gray-900">{t('portal.page.logs.logList')}</h3>
            <span className="text-xs text-gray-400">{t('portal.page.logs.totalRecords', { count: total.toLocaleString() })}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw className="h-3 w-3" /> {t('portal.page.logs.refresh')}
          </button>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('portal.page.logs.loading')}</p>
        ) : logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-400">
                  <th className="w-6 px-2 py-2.5"></th>
                  <th className="px-3 py-2.5 text-center font-medium">{t('portal.page.logs.time')}</th>
                  <th className="px-3 py-2.5 text-center font-medium">{t('portal.page.logs.tokenName')}</th>
                  <th className="px-3 py-2.5 text-center font-medium">{t('portal.page.logs.type')}</th>
                  <th className="px-3 py-2.5 text-center font-medium">{t('portal.page.logs.model')}</th>
                  <th className="px-3 py-2.5 text-center font-medium">{t('portal.page.logs.timingHeader')}</th>
                  <th className="px-3 py-2.5 text-center font-medium">{t('portal.page.logs.inputTokens')}</th>
                  <th className="px-3 py-2.5 text-center font-medium">{t('portal.page.logs.cost')}</th>
                  <th className="px-3 py-2.5 text-center font-medium">{t('portal.page.logs.status')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isError = log.type === 1
                  const isExpanded = expandedId === log.id
                  const totalTokens = (log.prompt_tokens ?? 0) + (log.completion_tokens ?? 0)
                  const cost = (log.quota ?? 0) / 500000
                  const otherData = parseOther(log.other)
                  const firstResponseTime = otherData?.frt ? (otherData.frt / 1000).toFixed(1) : null

                  return (
                    <Fragment key={log.id}>
                      <tr
                        className={`border-b border-gray-100 text-gray-600 transition cursor-pointer ${isError ? 'bg-red-500/[0.03]' : 'hover:bg-white'}`}
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <td className="px-2 py-3 text-center text-gray-400">
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform inline-block ${isExpanded ? 'rotate-90' : ''}`} />
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-gray-500">{dayjs.unix(log.created_at).format('YYYY-MM-DD HH:mm:ss')}</td>
                        <td className="px-3 py-3 text-center text-xs text-gray-500">{tokenDisplayName(log.token_name || '—')}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`rounded px-1.5 py-0.5 text-xs ${isError ? 'bg-red-500/15 text-red-400' : 'bg-blue-500/10 text-blue-300'}`}>
                            {isError ? t('portal.page.logs.error') : t('portal.page.logs.consume')}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{log.model_name || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-center text-xs">
                          {log.use_time ? (
                            <span className="text-gray-500">
                              {log.use_time}s
                              {firstResponseTime && <span className="ml-1 text-gray-400">{firstResponseTime}s</span>}
                              {log.is_stream && <span className="ml-1 rounded bg-cyan-500/10 px-1 text-[10px] text-cyan-400">{t('portal.page.logs.stream')}</span>}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-gray-500">
                          {totalTokens.toLocaleString()}
                          {otherData?.cache_tokens ? (
                            <span className="ml-1 text-[10px] text-gray-400">
                              {t('portal.page.logs.cacheRead')} {otherData.cache_tokens.toLocaleString()}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-center text-xs font-medium text-gray-600">${cost.toFixed(6)}</td>
                        <td className="px-3 py-3 text-center">
                          {isError ? (
                            <span className="inline-block rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-400">{t('portal.page.logs.failed')}</span>
                          ) : (
                            <span className="inline-block rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">{t('portal.page.logs.success')}</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="space-y-2 text-xs text-gray-500">
                              {log.request_id && (
                                <div className="flex gap-2">
                                  <span className="text-gray-400 min-w-24 shrink-0">{t('portal.page.logs.requestId')}</span>
                                  <span className="font-mono text-gray-500">{log.request_id}</span>
                                </div>
                              )}
                              {otherData?.cache_tokens != null && (
                                <div className="flex gap-2">
                                  <span className="text-gray-400 min-w-24 shrink-0">{t('portal.page.logs.cacheTokens')}</span>
                                  <span className="text-gray-500">{otherData.cache_tokens.toLocaleString()}</span>
                                </div>
                              )}
                              {otherData?.cache_creation_tokens != null && (
                                <div className="flex gap-2">
                                  <span className="text-gray-400 min-w-24 shrink-0">{t('portal.page.logs.cacheCreation')}</span>
                                  <span className="text-gray-500">{otherData.cache_creation_tokens.toLocaleString()}</span>
                                </div>
                              )}
                              {log.content && (
                                <div className="flex gap-2">
                                  <span className="text-gray-400 min-w-24 shrink-0">{t('portal.page.logs.logDetail')}</span>
                                  <span className="text-gray-500 break-all">{translateLogContent(log.content)}</span>
                                </div>
                              )}
                              {otherData?.model_ratio != null && (
                                <div className="flex gap-2">
                                  <span className="text-gray-400 min-w-24 shrink-0">{t('billingProcess')}</span>
                                  <div className="text-gray-500 space-y-0.5">
                                    <div>{t('Input Price')}：${(otherData.model_ratio * 2).toFixed(6)} / 1M tokens</div>
                                    {otherData.completion_ratio != null && (
                                      <div>{t('Output Price')}：${(otherData.model_ratio * 2 * otherData.completion_ratio).toFixed(6)} / 1M tokens</div>
                                    )}
                                    {otherData.cache_ratio != null && otherData.cache_ratio !== 1 && (
                                      <div>{t('Cache Read Price')}：${(otherData.model_ratio * 2 * otherData.cache_ratio).toFixed(6)} / 1M tokens</div>
                                    )}
                                    {otherData.cache_creation_ratio != null && otherData.cache_creation_ratio !== 1 && (
                                      <div>{t('portal.page.logs.cacheCreatePrice')}：${(otherData.model_ratio * 2 * otherData.cache_creation_ratio).toFixed(6)} / 1M tokens</div>
                                    )}
                                    {(() => {
                                      const inputPrice = otherData.model_ratio! * 2
                                      const outputPrice = inputPrice * (otherData.completion_ratio ?? 1)
                                      const promptT = log.prompt_tokens ?? 0
                                      const completionT = log.completion_tokens ?? 0
                                      const cacheT = otherData.cache_tokens ?? 0
                                      const cacheCreateT = otherData.cache_creation_tokens ?? 0
                                      const groupR = otherData.user_group_ratio != null && otherData.user_group_ratio !== -1 ? otherData.user_group_ratio : (otherData.group_ratio ?? 1)
                                      const parts: string[] = []
                                      if (promptT > 0) parts.push(`${t('Prompt')} ${promptT} tokens / 1M * $${inputPrice.toFixed(6)}`)
                                      if (cacheT > 0) parts.push(`${t('portal.page.logs.cacheRead')} ${cacheT} tokens / 1M * $${(inputPrice * (otherData.cache_ratio ?? 1)).toFixed(6)}`)
                                      if (cacheCreateT > 0) parts.push(`${t('portal.page.logs.cacheCreate')} ${cacheCreateT} tokens / 1M * $${(inputPrice * (otherData.cache_creation_ratio ?? 1)).toFixed(6)}`)
                                      if (completionT > 0) parts.push(`${t('Completion')} ${completionT} tokens / 1M * $${outputPrice.toFixed(6)}`)
                                      if (groupR !== 1) parts.push(`${t('Group Ratio')} ${groupR}x`)
                                      const total = (log.quota ?? 0) / 500000
                                      return (
                                        <div className="mt-1 text-gray-400">
                                          {parts.join(' + ')} = ${total.toFixed(6)}
                                        </div>
                                      )
                                    })()}
                                  </div>
                                </div>
                              )}
                              {otherData?.request_path && (
                                <div className="flex gap-2">
                                  <span className="text-gray-400 min-w-24 shrink-0">{t('Request Path')}</span>
                                  <span className="text-gray-500 font-mono">{otherData.request_path}</span>
                                </div>
                              )}
                              {log.ip && (
                                <div className="flex gap-2">
                                  <span className="text-gray-400 min-w-24 shrink-0">IP</span>
                                  <span className="text-gray-500">{log.ip}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">{t('portal.page.logs.noData')}</p>
              <p className="mt-1 text-xs text-gray-400">{t('portal.page.logs.noRecordsFound')}</p>
            </div>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <span>{t('portal.page.logs.perPage')}</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>{t('portal.page.logs.totalItems', { count: total.toLocaleString() })}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-30"
              >
                ‹
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`rounded-md px-2.5 py-1 transition ${
                    page === p ? 'bg-sky-600 text-gray-900' : 'border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              {totalPages > 5 && <span className="px-1">...</span>}
              {totalPages > 5 && (
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  className={`rounded-md px-2.5 py-1 transition ${
                    page === totalPages ? 'bg-sky-600 text-gray-900' : 'border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {totalPages}
                </button>
              )}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
