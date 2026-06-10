import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  Headphones,
  Lock,
  Moon,
  Shield,
  Zap,
  DollarSign,
  Puzzle,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { api } from '@/lib/api'
import { getLobeIcon } from '@/lib/lobe-icon'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function useHomePageContent() {
  return useQuery({
    queryKey: ['home-page-content'],
    queryFn: async () => {
      const res = await api.get('/api/home_page_content')
      return (res.data?.data as string) || ''
    },
    staleTime: 120_000,
  })
}

const NAV_LINKS: Array<{ label: string; to: string; external?: boolean; useDocsUrl?: boolean }> = []

function LandingPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { status } = useStatus()
  const user = useAuthStore((s) => s.auth.user)
  const { data: homeContent } = useHomePageContent()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const source = (status?.data ?? status) as Record<string, unknown> | null | undefined
  const systemName =
    typeof source?.system_name === 'string' && source.system_name.trim()
      ? (source.system_name as string)
      : 'New API'
  const docsUrl =
    typeof source?.docs_link === 'string' && (source.docs_link as string).trim()
      ? (source.docs_link as string)
      : ''
  const faqEnabled = source?.faq_enabled !== false
  const faqFromBackend = Array.isArray(source?.faq) ? (source.faq as Array<{ question: string; answer: string }>) : null

  const DEFAULT_FAQ = [
    { question: t('What is Onpleas?'), answer: t('Onpleas is a unified AI model API aggregation platform. One API key to access OpenAI, Claude, Gemini, DeepSeek and 100+ models — no multi-platform setup needed.') },
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

  const handleCTA = () => {
    if (!user) {
      navigate({ to: '/sign-in' })
    } else if (user.role >= ROLE.ADMIN) {
      navigate({ to: '/dashboard' })
    } else {
      navigate({ to: '/portal' })
    }
  }

  const switchLang = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(next)
    localStorage.setItem('i18nextLng', next)
  }

  const stats = [
    { value: '100T', label: t('Monthly Tokens') },
    { value: '8M+', label: t('Global Users') },
    { value: '60+', label: t('Providers') },
    { value: `${modelCount || 400}+`, label: t('Models') },
  ]

  const features = [
    {
      icon: Boxes,
      title: t('One API for Any Model'),
      desc: t('Access all major models through a single, unified interface. OpenAI SDK works out of the box.'),
      linkText: t('Browse all'),
      linkUrl: '/models',
    },
    {
      icon: Shield,
      title: t('Higher Availability'),
      desc: t('Reliable AI models via our distributed infrastructure. Fall back to other providers when one goes down.'),
      linkText: t('Learn more'),
      linkUrl: docsUrl || '/docs/availability',
    },
    {
      icon: Zap,
      title: t('Price and Performance'),
      desc: t('Keep costs in check without sacrificing speed. OpenRouter runs at the edge for minimal latency between your users and their inference.'),
      linkText: t('Learn more'),
      linkUrl: docsUrl || '/docs/performance',
    },
    {
      icon: Lock,
      title: t('Custom Data Policies'),
      desc: t('Protect your organization with fine grained data policies. Ensure prompts only go to the models and providers you trust.'),
      linkText: t('View docs'),
      linkUrl: docsUrl || '/docs/data-policies',
    },
  ]

  return (
    <div className="relative flex min-h-svh flex-col bg-[#0a0a14] text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a14]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="text-xl font-bold tracking-wide text-orange-400">
            {systemName}
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={switchLang}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10"
            >
              <Globe className="h-3.5 w-3.5" />
              {i18n.language === 'zh' ? 'EN' : '中文'}
            </button>

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
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a0a14] to-[#0f0f1a]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center">
          <h1 className="mb-6 text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            {t('The Unified Interface For LLMs')}
          </h1>
          <p className="mb-10 text-lg text-white/60">
            {t('Better')} <span className="text-indigo-400 font-semibold">{t('prices')}</span>, {t('better')} <span className="text-indigo-400 font-semibold">{t('uptime')}</span>, {t('no subscriptions')}.
          </p>

          <div className="mb-16 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleCTA}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500"
            >
              {t('Get API Key')}
            </button>
            <Link
              to="/models"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-8 py-3.5 text-base font-medium text-white transition hover:bg-white/10"
            >
              {t('Explore Models')}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat, idx) => (
              <div key={stat.label} className="flex flex-col items-center gap-2">
                <span className={`text-4xl font-bold ${idx === 3 ? 'text-indigo-400' : 'text-white'}`}>
                  {stat.value}
                </span>
                <span className="text-sm text-white/50">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-8 transition hover:border-indigo-500/30 hover:bg-white/[0.04]"
                >
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                    <Icon className="h-8 w-8 text-indigo-300" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-white">{f.title}</h3>
                  <p className="mb-6 flex-1 text-sm leading-relaxed text-white/60">{f.desc}</p>
                  <a
                    href={f.linkUrl}
                    className="inline-flex items-center gap-1 text-sm font-medium text-indigo-400 transition hover:text-indigo-300"
                  >
                    {f.linkText}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="mx-auto w-full max-w-7xl px-6 py-20">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-3xl font-bold text-white">
              {t('Featured Models')}
              <ChevronRight className="h-6 w-6 text-white/40" />
            </h2>
            <p className="text-sm text-white/50">{modelCount || 400}+ {t('active models on')} 60+ {t('providers')}</p>
          </div>
          <Link
            to="/models"
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-400 transition hover:text-indigo-300"
          >
            {t('View all')}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              name: 'Claude Opus 4.8',
              provider: 'anthropic',
              badge: 'New',
              tokens: '966.7B',
              trend: '0%',
              trendColor: 'text-white/50',
            },
            {
              name: 'GPT-5.5',
              provider: 'openai',
              badge: null,
              tokens: '451.2B',
              trend: '-18%',
              trendColor: 'text-red-400',
            },
            {
              name: 'Gemini 3.1 Pro Preview',
              provider: 'google',
              badge: null,
              tokens: '240.3B',
              trend: '-25%',
              trendColor: 'text-red-400',
            },
          ].map((model) => (
            <div
              key={model.name}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-indigo-500/30 hover:bg-white/[0.04]"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                    {getLobeIcon(
                      model.provider === 'anthropic'
                        ? 'Claude.Color'
                        : model.provider === 'openai'
                          ? 'OpenAI.Color'
                          : 'Gemini.Color',
                      28
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1 text-base font-semibold text-white">{model.name}</h3>
                    {model.badge && (
                      <span className="inline-block rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
                        {model.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-sm text-white/50">by {model.provider}</div>
              <div className="mt-6 flex items-end justify-between border-t border-white/5 pt-4">
                <div>
                  <div className="mb-1 text-xs text-white/40">{t('Tokens')}</div>
                  <div className="text-xl font-bold text-white">{model.tokens}</div>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-xs text-white/40">{t('Weekly Trend')}</div>
                  <div className={`text-lg font-semibold ${model.trendColor}`}>{model.trend}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Partners / Vendors */}
      {vendors.length > 0 && (
        <section className="border-t border-white/5 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-8 text-center text-sm text-white/30">{t('Trusted Partners')}</p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {vendors.slice(0, 8).map((v) => (
                <span
                  key={v.id}
                  className="text-sm font-medium text-white/40 transition hover:text-white/70"
                >
                  {v.name}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Getting Started Steps */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col items-start">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-xl font-bold text-indigo-300">
                1
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">{t('Signup')}</h3>
              <p className="mb-4 text-sm leading-relaxed text-white/60">
                {t('Create an account to get started. You can set up an org for your team later.')}
              </p>
              <div className="mt-auto flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                  <Globe className="h-5 w-5 text-white/40" />
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                  {getLobeIcon('GitHub.Color', 20)}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                  {getLobeIcon('Google.Color', 20)}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-xl font-bold text-indigo-300">
                2
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">{t('Buy credits')}</h3>
              <p className="mb-4 text-sm leading-relaxed text-white/60">
                {t('Credits can be used with any model or provider.')}
              </p>
              <div className="mt-auto space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <DollarSign className="h-4 w-4 text-indigo-400" />
                  <span className="text-white/50">Apr 1</span>
                  <span className="ml-auto font-semibold text-white">$99</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <DollarSign className="h-4 w-4 text-indigo-400" />
                  <span className="text-white/50">Mar 30</span>
                  <span className="ml-auto font-semibold text-white">$10</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-xl font-bold text-indigo-300">
                3
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">{t('Get your API key')}</h3>
              <p className="mb-4 text-sm leading-relaxed text-white/60">
                {t('Create an API key and start making requests.')} <a href={docsUrl} className="text-indigo-400 hover:text-indigo-300">{t('Fully OpenAI compatible.')}</a>
              </p>
              <div className="mt-auto flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <FileText className="h-4 w-4 text-white/40" />
                <span className="text-sm text-white/50">OPENROUTER_API_KEY</span>
              </div>
              <div className="mt-2 font-mono text-sm text-white/30">••••••••••••••••</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      {faqEnabled && (
        <section className="border-t border-white/5 py-20">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="mb-12 text-center text-3xl font-bold text-white">{t('FAQ')}</h2>
            <div className="flex flex-col gap-4">
              {faqItems.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-white/[0.02] transition hover:border-white/20"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between px-6 py-5 text-left"
                  >
                    <span className="text-base font-medium text-white">{item.question}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-white/40 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="border-t border-white/5 px-6 pb-5 pt-4">
                      <p className="text-sm leading-relaxed text-white/60">{item.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 bg-white/[0.01] py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">{t('Product')}</h4>
              <div className="flex flex-col gap-2">
                <Link to="/models" className="text-sm text-white/50 hover:text-white/80 transition">{t('Models')}</Link>
                <Link to="/pricing" className="text-sm text-white/50 hover:text-white/80 transition">{t('Pricing')}</Link>
                <a href={docsUrl} className="text-sm text-white/50 hover:text-white/80 transition">{t('Documentation')}</a>
              </div>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">{t('Company')}</h4>
              <div className="flex flex-col gap-2">
                <Link to="/about" className="text-sm text-white/50 hover:text-white/80 transition">{t('About')}</Link>
                <Link to="/privacy-policy" className="text-sm text-white/50 hover:text-white/80 transition">{t('Privacy')}</Link>
                <Link to="/user-agreement" className="text-sm text-white/50 hover:text-white/80 transition">{t('Terms of Service')}</Link>
              </div>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">{t('Developer')}</h4>
              <div className="flex flex-col gap-2">
                <a href={docsUrl} className="text-sm text-white/50 hover:text-white/80 transition">{t('Documentation')}</a>
                <a href={`${docsUrl}/api`} className="text-sm text-white/50 hover:text-white/80 transition">{t('API Reference')}</a>
              </div>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">{t('Connect')}</h4>
              <div className="flex flex-col gap-2">
                <a href="https://discord.gg/openrouter" target="_blank" rel="noreferrer" className="text-sm text-white/50 hover:text-white/80 transition">Discord</a>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="text-sm text-white/50 hover:text-white/80 transition">GitHub</a>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-white/5 pt-8 text-center">
            <span className="text-sm text-white/30">
              © {new Date().getFullYear()} {systemName}. {t('All rights reserved')}.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
