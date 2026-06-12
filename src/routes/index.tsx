import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Mail,
  Play,
  Send,
  Shield,
  Zap,
  DollarSign,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { api } from '@/lib/api'
import { getFrontendModels } from '@/features/frontend-portal/api'
import { parseModelTags } from '@/features/frontend-portal/model-tags'
import { ModelBadges } from '@/features/frontend-portal/model-badges'
import { ModelModalityBadge } from '@/features/frontend-portal/model-modality-badge'
import type { FrontendModel } from '@/features/frontend-portal/types'
import { getLobeIcon } from '@/lib/lobe-icon'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

// 与模型广场保持一致的固定 5 标签多语言映射；其它标签原样显示。
const TAG_I18N_KEY: Record<string, string> = {
  '文本推理': 'portal.tag.text', text: 'portal.tag.text',
  '图像': 'portal.tag.image', image: 'portal.tag.image',
  '音频': 'portal.tag.voice', voice: 'portal.tag.voice',
  '视频': 'portal.tag.video', video: 'portal.tag.video',
  '视觉': 'portal.tag.visual', visual: 'portal.tag.visual',
}

const CODE_SAMPLES = [
  { lang: 'cURL', code: `curl https://api.xendalink.com/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.5",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'` },
  { lang: 'Python', code: `from openai import OpenAI

client = OpenAI(
    base_url="https://api.xendalink.com/v1",
    api_key="YOUR_API_KEY",
)

resp = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)` },
  { lang: 'JavaScript', code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.xendalink.com/v1",
  apiKey: "YOUR_API_KEY",
});

const resp = await client.chat.completions.create({
  model: "gpt-5.5",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(resp.choices[0].message.content);` },
  { lang: 'Go', code: `package main

import "github.com/sashabaranov/go-openai"

func main() {
    cfg := openai.DefaultConfig("YOUR_API_KEY")
    cfg.BaseURL = "https://api.xendalink.com/v1"
    client := openai.NewClientWithConfig(cfg)
    // client.CreateChatCompletion(...)
    _ = client
}` },
]

const PERF_FEATURES = [
  { icon: Zap, title: 'Smart Routing', desc: 'Automatically routes requests to the fastest and most reliable upstream providers.' },
  { icon: DollarSign, title: 'Cost Optimization', desc: 'Access top models at the best prices with transparent and unified billing.' },
  { icon: Shield, title: 'Enterprise Reliability', desc: 'Multi-region deployment with 99.9% uptime, failover, and real-time monitoring.' },
  { icon: Globe, title: 'Global Coverage', desc: 'Optimized network across Russia, the Middle East, Europe and Asia.' },
]

const LANDING_STATS = [
  { value: '2.5B+', label: 'Requests Served' },
  { value: '120+', label: 'Models Available' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '50ms', label: 'Average Latency' },
  { value: '100+', label: 'Countries Covered' },
]

const GETTING_STARTED = [
  { title: 'Register an account', desc: 'Create an account on the platform and activate access in seconds.' },
  { title: 'Top up credits', desc: 'Top up on demand or subscribe to a plan — flexible billing.' },
  { title: 'Create an API Key', desc: 'Generate a key in the console and start calling right away.' },
  { title: 'Integrate', desc: 'Fully OpenAI-compatible API format — deploy in minutes.' },
]

// 轻量代码高亮：字符串 / 注释 / 数字 / 关键字着色（适配浅色编辑器主题）
function highlightCode(code: string) {
  const re =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/[^\n]*|#[^\n]*)|(\b\d+(?:\.\d+)?\b)|(\b(?:curl|import|from|const|let|var|func|package|await|async|new|return|print|def|client|true|false|null|main)\b)/g
  const nodes: any[] = []
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(code))) {
    if (m.index > last) nodes.push(code.slice(last, m.index))
    let cls = ''
    if (m[1]) cls = 'text-emerald-700'
    else if (m[2]) cls = 'text-gray-400 italic'
    else if (m[3]) cls = 'text-sky-600'
    else if (m[4]) cls = 'text-purple-600'
    nodes.push(
      <span key={key++} className={cls}>
        {m[0]}
      </span>
    )
    last = m.index + m[0].length
  }
  if (last < code.length) nodes.push(code.slice(last))
  return nodes
}

function LandingPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { status } = useStatus()
  const user = useAuthStore((s) => s.auth.user)
  // 模型广场分流：管理员→原版 /pricing；用户/未登录→二开 /portal/models（未登录为公开页）
  const modelsHref = user && user.role >= ROLE.ADMIN ? '/pricing' : '/portal/models'
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [codeTab, setCodeTab] = useState(0)

  const source = (status?.data ?? status) as Record<string, unknown> | null | undefined
  const systemName =
    typeof source?.system_name === 'string' && source.system_name.trim()
      ? (source.system_name as string)
      : 'New API'
  const docsUrl =
    typeof source?.docs_link === 'string' && (source.docs_link as string).trim()
      ? (source.docs_link as string)
      : ''
  const logoUrl =
    typeof source?.logo === 'string' && (source.logo as string).trim()
      ? (source.logo as string)
      : ''
  const faqEnabled = source?.faq_enabled !== false
  const faqFromBackend = Array.isArray(source?.faq) ? (source.faq as Array<{ question: string; answer: string }>) : null

  const DEFAULT_FAQ = [
    { question: t('What is {{brand}}?', { brand: systemName }), answer: t('{{brand}} is a unified AI model API aggregation platform. One API key to access OpenAI, Claude, Gemini, DeepSeek and 100+ models — no multi-platform setup needed.', { brand: systemName }) },
    { question: t('How do I get started?'), answer: t('Three steps: 1. Register on the site; 2. Top up or get quota; 3. Get your API Key and start calling. Takes under 5 minutes. Compatible with OpenAI standard API format for seamless migration.') },
    { question: t('Which AI models are supported?'), answer: t('50+ mainstream AI models including OpenAI (GPT-4o, GPT-5, o-series), Anthropic Claude, Google, and more. Continuously expanding.') },
    { question: t('How is data security ensured?'), answer: t('We respect your privacy. All data is transmitted via encrypted channels. We strictly comply with applicable laws and regulations. Use with confidence.') },
  ]
  const faqItems = faqFromBackend && faqFromBackend.length > 0 ? faqFromBackend : DEFAULT_FAQ

  const { data: pricingData } = useQuery({
    queryKey: ['landing-pricing'],
    queryFn: async () => {
      const res = await api.get('/api/pricing')
      return res.data?.data as { vendors?: Array<{ id: number; name: string; icon?: string }>; models?: Array<{ model_name: string; vendor_name?: string }> } | undefined
    },
    staleTime: 120_000,
  })

  const vendors = pricingData?.vendors ?? []
  const modelCount = pricingData?.models?.length ?? 0

  const { data: frontendModels } = useQuery({
    queryKey: ['landing-frontend-models'],
    queryFn: getFrontendModels,
    staleTime: 120_000,
  })

  // 首页精选区：取打了 !精选_N 标签的模型，按 N 升序；若没有任何精选标签，回退取前 3 个。
  const featuredModels = (() => {
    const all = (frontendModels?.models ?? []) as FrontendModel[]
    const parsedAll = all.map((m) => ({ model: m, parsed: parseModelTags(m.tags) }))
    const tagged = parsedAll
      .filter((x) => x.parsed.isFeatured)
      .sort((a, b) => a.parsed.featuredOrder - b.parsed.featuredOrder)
    const chosen = tagged.length > 0 ? tagged : parsedAll.slice(0, 3)
    return chosen.map(({ model, parsed }) => ({
      name: model.model_name,
      provider: model.vendor_name || '',
      icon: model.icon,
      description: model.description,
      tags: parsed.visibleTags,
      modalityTags: model.tags,
      badges: parsed.badges,
    }))
  })()

  // 描述支持三语 JSON（{"zh":"...","en":"...","ru":"..."}），按当前语言显示；纯文本原样返回
  const uiLang = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('zh') ? 'zh' : 'en'
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

  const handleGetKey = () => {
    navigate({ to: user ? '/portal/tokens' : '/sign-in' })
  }

  const copyText = (text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
        return
      }
      throw new Error('no clipboard')
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        /* ignore */
      }
    }
  }

  const LANGS: Array<{ code: string; label: string }> = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
  ]
  const currentLang = i18n.language?.startsWith('ru')
    ? 'ru'
    : i18n.language?.startsWith('zh')
      ? 'zh'
      : 'en'
  const changeLang = (code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem('i18nextLng', code)
    setLangMenuOpen(false)
  }

  const stats = [
    { value: '100T', label: t('Monthly Tokens') },
    { value: '8M+', label: t('Global Users') },
    { value: '60+', label: t('Providers') },
    { value: `${modelCount || 400}+`, label: t('Models') },
  ]

  return (
    <div className="relative flex min-h-svh flex-col bg-white text-gray-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-wide text-orange-400">
            {logoUrl ? <img src={logoUrl} alt={systemName} className="h-8 w-8 rounded" /> : null}
            {systemName}
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
              >
                <Globe className="h-3.5 w-3.5" />
                {LANGS.find((l) => l.code === currentLang)?.label ?? 'English'}
                <ChevronDown className="h-3 w-3" />
              </button>
              {langMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangMenuOpen(false)} />
                  <div className="absolute right-0 z-50 mt-1 min-w-[130px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
                    {LANGS.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => changeLang(l.code)}
                        className={`block w-full px-4 py-2 text-left text-xs transition hover:bg-gray-100 ${currentLang === l.code ? 'text-indigo-600' : 'text-gray-600'}`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {user ? (
              <Link
                to={user.role >= ROLE.ADMIN ? '/dashboard' : '/portal'}
                className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                {t('Console')}
              </Link>
            ) : (
              <Link
                to="/sign-in"
                className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                {t('Get Started')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#f7f9fc]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center">
          <h1 className="mb-6 text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            {t('The Unified Interface For LLMs')}
          </h1>
          <p className="mb-10 text-lg text-gray-600">
            {t('Better')} <span className="text-indigo-600 font-semibold">{t('prices')}</span>, {t('better')} <span className="text-indigo-600 font-semibold">{t('uptime')}</span>, {t('no subscriptions')}.
          </p>

          <div className="mb-16 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleGetKey}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500"
            >
              {t('Get API Key')}
            </button>
            <Link
              to={modelsHref}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-100 px-8 py-3.5 text-base font-medium text-gray-900 transition hover:bg-gray-100"
            >
              {t('Explore Models')}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat, idx) => (
              <div key={stat.label} className="flex flex-col items-center gap-2">
                <span className={`text-4xl font-bold ${idx === 3 ? 'text-indigo-600' : 'text-gray-900'}`}>
                  {stat.value}
                </span>
                <span className="text-sm text-gray-500">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="border-t border-gray-200 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-[#f8fafc] shadow-sm">
              <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-4 py-2">
                {CODE_SAMPLES.map((s, i) => (
                  <button
                    key={s.lang}
                    type="button"
                    onClick={() => setCodeTab(i)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${codeTab === i ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    {s.lang}
                  </button>
                ))}
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-gray-800">
                <code>{highlightCode(CODE_SAMPLES[codeTab].code)}</code>
              </pre>
            </div>
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 self-start rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('OpenAI Compatible')}
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="mb-1 text-xs font-medium text-gray-400">{t('Base URL')}</div>
                <button
                  type="button"
                  onClick={() => copyText('https://api.xendalink.com/v1')}
                  title={t('Copy')}
                  className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-gray-800 transition hover:text-indigo-600"
                >
                  <span className="truncate">https://api.xendalink.com/v1</span>
                  <Copy className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600">99.9% Uptime</span>
                <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600">{t('Global Routing')}</span>
                <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600">{t('Unified Billing')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built for performance and scale */}
      <section className="border-t border-gray-200 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-indigo-600">{t('Why developers choose us')}</p>
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">{t('Built for performance and scale')}</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PERF_FEATURES.map((p) => {
              const PerfIcon = p.icon
              return (
                <div key={p.title} className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                    <PerfIcon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">{t(p.title)}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{t(p.desc)}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-10 grid grid-cols-2 gap-6 rounded-2xl border border-gray-200 bg-white p-8 sm:grid-cols-3 lg:grid-cols-5">
            {LANDING_STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-indigo-600 sm:text-3xl">{s.value}</div>
                <div className="mt-1 text-xs text-gray-500">{t(s.label)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-3xl font-bold text-gray-900">
              {t('Featured Models')}
              <ChevronRight className="h-6 w-6 text-gray-400" />
            </h2>
          </div>
          <Link
            to={modelsHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition hover:text-indigo-600"
          >
            {t('View all')}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredModels.map((model) => (
            <Link
              key={model.name}
              to={modelsHref}
              className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-indigo-500/30 hover:bg-gray-50"
            >
              <ModelBadges badges={model.badges} cornerClass="rounded-tr-2xl" />
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                  {getLobeIcon(model.icon, 28)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-base font-semibold text-gray-900">{model.name}</h3>
                    <ModelModalityBadge modelName={model.name} tags={model.modalityTags} />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-500 line-clamp-2">
                {pickDesc(model.description) || t('No description available')}
              </p>
              {model.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {model.tags.map((tg) => (
                    <span
                      key={tg}
                      className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {tagLabel(tg)}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Partners / Vendors */}
      {vendors.length > 0 && (
        <section className="border-t border-gray-200 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-8 text-center text-sm text-gray-400">{t('Trusted Partners')}</p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {vendors.slice(0, 8).map((v) => (
                <span
                  key={v.id}
                  className="text-sm font-medium text-gray-400 transition hover:text-gray-600"
                >
                  {v.name}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Getting Started Steps */}
      <section className="bg-gradient-to-b from-[#f7f9fc] to-[#eaf0f8] py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-600">
              <Play className="h-3.5 w-3.5 fill-blue-600" />
              {t('Quick Start')}
            </span>
          </div>
          <h2 className="mb-12 text-center text-3xl font-black text-gray-900 sm:text-4xl">
            {t('Onboard in just a few steps')}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {GETTING_STARTED.map((s, i) => (
              <div
                key={s.title}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-gray-900 shadow-sm">
                  {i + 1}
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">{t(s.title)}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{t(s.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      {faqEnabled && (
        <section className="border-t border-gray-200 py-20">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">{t('FAQ')}</h2>
            <div className="flex flex-col gap-4">
              {faqItems.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 bg-white transition hover:border-gray-300"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between px-6 py-5 text-left"
                  >
                    <span className="text-base font-medium text-gray-900">{item.question}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="border-t border-gray-200 px-6 pb-5 pt-4">
                      <p className="text-sm leading-relaxed text-gray-600">{item.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50/60 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div>
              <div className="mb-4 flex items-center gap-2">
                {logoUrl ? <img src={logoUrl} alt={systemName} className="h-7 w-7 rounded" /> : null}
                <span className="text-lg font-bold text-orange-400">{systemName}</span>
              </div>
              <p className="mb-4 max-w-xs text-sm leading-relaxed text-gray-500">
                {t('The global AI API gateway for developers and enterprises. One API, every AI model.')}
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://t.me/iXendabot"
                  target="_blank"
                  rel="noreferrer"
                  title="Telegram"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <Send className="h-4 w-4" />
                </a>
                <a
                  href="mailto:support@xendalink.com"
                  title="support@xendalink.com"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <Mail className="h-4 w-4" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-900">{t('Product')}</h4>
              <div className="flex flex-col gap-2">
                <Link to={modelsHref} className="text-sm text-gray-500 hover:text-gray-700 transition">{t('Models')}</Link>
              </div>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-900">{t('Company')}</h4>
              <div className="flex flex-col gap-2">
                <Link to="/about" className="text-sm text-gray-500 hover:text-gray-700 transition">{t("About")}</Link>
                <Link to="/privacy-policy" className="text-sm text-gray-500 hover:text-gray-700 transition">{t("Privacy")}</Link>
                <Link to="/user-agreement" className="text-sm text-gray-500 hover:text-gray-700 transition">{t("Terms of Service")}</Link>
              </div>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-gray-900">{t('Developer')}</h4>
              <div className="flex flex-col gap-2">
                <a href={docsUrl} className="text-sm text-gray-500 hover:text-gray-700 transition">{t('Documentation')}</a>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-gray-200 pt-8 text-center">
            <span className="text-sm text-gray-400">
              © {new Date().getFullYear()} {systemName}. {t('All rights reserved')}.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
