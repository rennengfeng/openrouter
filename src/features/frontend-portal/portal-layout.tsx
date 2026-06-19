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
 * Berry portal layout — the side-rail + top-bar shell that wraps every
 * /portal/* route. Designed to overlay on top of the existing default theme
 * without touching backend code: brand name and logo come from /api/status.
 */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileClock,
  Gauge,
  Gift,
  Home,
  KeyRound,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  Settings,
  User,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useStatus } from '@/hooks/use-status'
import { api } from '@/lib/api'
import { pickLang } from '@/lib/multilang'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type NavItem = {
  to: string
  labelKey: string
  icon: LucideIcon
  external?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/portal', labelKey: 'portal.home', icon: Home },
  { to: '/portal/dashboard', labelKey: 'portal.dashboard', icon: BarChart3 },
  { to: '/portal/logs', labelKey: 'portal.logs', icon: FileClock },
  { to: '/portal/tokens', labelKey: 'portal.tokens', icon: KeyRound },
  { to: '/portal/models', labelKey: 'portal.models', icon: Boxes },
  { to: '/portal/chat', labelKey: 'portal.chat', icon: MessageCircle },
  { to: '/portal/monitor', labelKey: 'portal.monitor', icon: Gauge },
  { to: '/portal/topup', labelKey: 'portal.recharge', icon: CreditCard },
  { to: '/portal/affiliate', labelKey: 'portal.affiliate', icon: Gift },
  { to: '/docs/contact.html', labelKey: 'portal.contact', icon: Mail, external: true },
  { to: '/portal/settings', labelKey: 'portal.settings', icon: Settings },
]

function useBrand() {
  const { status } = useStatus()
  const source = (status?.data ?? status) as
    | Record<string, unknown>
    | null
    | undefined
  const name =
    typeof source?.system_name === 'string' && source.system_name.trim()
      ? (source.system_name as string).trim()
      : 'New API'
  const logo =
    typeof source?.logo === 'string' && source.logo.trim()
      ? (source.logo as string)
      : '/logo.png'
  const docsUrl =
    typeof source?.docs_link === 'string' && (source.docs_link as string).trim()
      ? (source.docs_link as string)
      : ''
  return { name, logo, docsUrl }
}

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const [noticeTab, setNoticeTab] = useState<'notice' | 'timeline'>('notice')
  const authStore = useAuthStore((s) => s.auth)
  const user = authStore.user
  const { t, i18n } = useTranslation()
  const brand = useBrand()
  const location = useLocation()
  const navigate = useNavigate()

  const { data: noticeData } = useQuery({
    queryKey: ['portal-notice-bell'],
    queryFn: async () => {
      const res = await api.get('/api/notice', { skipErrorHandler: true } as Record<string, unknown>)
      return typeof res.data?.data === 'string' && res.data.data.trim() ? res.data.data : null
    },
    staleTime: 60_000,
  })

  const { status: portalStatus } = useStatus()
  const announcements = (portalStatus?.announcements_enabled ? (portalStatus?.announcements ?? []) : []) as Array<{ content?: string; publishDate?: string; type?: string }>

  const hasNotice = Boolean(noticeData) && !noticeDismissed

  useEffect(() => {
    setNoticeDismissed(false)
  }, [noticeData])

  const currentLang = i18n.language?.startsWith('ru')
    ? 'ru'
    : i18n.language?.startsWith('zh')
      ? 'zh'
      : 'en'
  const changeLang = (code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem('i18nextLng', code)
  }

  const initial = user?.username
    ? user.username.charAt(0).toUpperCase()
    : user?.display_name
      ? user.display_name.charAt(0).toUpperCase()
      : 'U'

  const handleSignOut = () => {
    authStore.reset()
    navigate({ to: '/sign-in' })
  }

  return (
    <div className="flex h-svh flex-col bg-white text-gray-900" style={{ colorScheme: 'light', '--background': '#ffffff', '--foreground': '#1a1a2e', '--card': '#ffffff', '--card-foreground': '#1a1a2e', '--popover': '#ffffff', '--popover-foreground': '#1a1a2e', '--border': '#e5e7eb', '--input': '#f3f4f6', '--primary': '#0ea5e9', '--primary-foreground': '#ffffff', '--secondary': '#f3f4f6', '--secondary-foreground': '#374151', '--muted': '#f9fafb', '--muted-foreground': '#6b7280', '--accent': '#f0f9ff', '--accent-foreground': '#0284c7', '--destructive': '#ef4444', '--ring': '#0ea5e9', '--sidebar-active': 'linear-gradient(to right, rgba(56,189,248,0.95), rgba(14,165,233,0.95))' } as React.CSSProperties}>
      {/* Top bar */}
      <header className="z-30 flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold text-gray-900"
          >
            {brand.logo ? (
              <img
                src={brand.logo}
                alt={brand.name}
                className="h-7 w-7 rounded"
              />
            ) : null}
            <span>{brand.name}</span>
          </Link>
          {brand.docsUrl ? (
            <a
              href={brand.docsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="ml-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              {t('Help Docs')} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <Link
              to="/portal/docs"
              className="ml-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              {t('Help Docs')} <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setNoticeOpen(true); setNoticeDismissed(true) }}
            className="relative rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            title={t('Announcements')}
          >
            <Bell className="h-4.5 w-4.5" />
            {hasNotice && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
          <div className="flex items-center gap-0.5 rounded-md border border-gray-200 p-0.5" title={t('portal.lang.toggle')}>
            {[{ c: 'zh', l: '中' }, { c: 'en', l: 'EN' }, { c: 'ru', l: 'RU' }].map((o) => (
              <button
                key={o.c}
                type="button"
                onClick={() => changeLang(o.c)}
                className={`rounded px-2 py-1 text-xs font-medium transition ${currentLang === o.c ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {o.l}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 rounded-full outline-none cursor-pointer"
              title={user?.username || 'profile'}
            >
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-sm font-semibold text-gray-900 shadow">
                {initial}
              </div>
              <span className="text-sm text-gray-700 hidden sm:inline">{user?.username || user?.display_name || 'User'}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-48">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user?.username || user?.display_name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: '/portal' })}>
                <User className="mr-2 h-4 w-4" />
                {t('portal.profile')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate({ to: '/portal/topup' })}>
                <Wallet className="mr-2 h-4 w-4" />
                {t('portal.wallet')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate({ to: '/portal/settings' })}>
                <Settings className="mr-2 h-4 w-4" />
                {t('portal.settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4 text-red-400" />
                <span className="text-red-400">{t('portal.signout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className={cn(
            'shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50/50 px-3 py-4 transition-[width] duration-200',
            collapsed ? 'w-[60px]' : 'w-[200px]'
          )}
        >
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="mb-4 flex h-9 w-full items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition"
            title={collapsed ? t('Expand') : t('Collapse')}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                !item.external && (location.pathname === item.to ||
                (item.to !== '/portal' &&
                  location.pathname.startsWith(`${item.to}/`)))
              const Icon = item.icon
              const label = t(item.labelKey)
              const cls = cn(
                'group flex items-center gap-3 text-sm font-medium transition rounded-lg',
                collapsed
                  ? 'justify-center px-2 py-2.5'
                  : 'px-3 py-2.5',
                active
                  ? 'bg-sky-600 text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )
              if (item.external) {
                return (
                  <a
                    key={item.to}
                    href={item.to}
                    className={cls}
                    title={label}
                  >
                    <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-gray-900' : 'text-gray-400')} />
                    {!collapsed ? <span>{label}</span> : null}
                  </a>
                )
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cls}
                  title={label}
                >
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0',
                      active ? 'text-gray-900' : 'text-gray-400'
                    )}
                  />
                  {!collapsed ? <span>{label}</span> : null}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-white p-6">{children}</main>
      </div>

      {/* Notice Modal */}
      {noticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setNoticeOpen(false)}>
          <div
            className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Bell className="h-5 w-5 text-sky-600" />
                {t('portal.notice.title')}
              </h2>
              <button
                type="button"
                onClick={() => setNoticeOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Tabs */}
            <div className="mb-4 flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              <button
                type="button"
                onClick={() => setNoticeTab('notice')}
                className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition', noticeTab === 'notice' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-600')}
              >
                <Bell className="h-3.5 w-3.5" />{t('portal.notice.tab.notice')}
              </button>
              <button
                type="button"
                onClick={() => setNoticeTab('timeline')}
                className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition', noticeTab === 'timeline' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-600')}
              >
                <Megaphone className="h-3.5 w-3.5" />{t('portal.notice.tab.timeline')}
              </button>
            </div>
            {/* Tab Content */}
            {noticeTab === 'notice' ? (
              noticeData ? (
                <div className="prose prose-invert prose-sm max-h-[400px] overflow-y-auto text-gray-600">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {pickLang(noticeData, i18n.language)}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-gray-400">{t('portal.notice.empty')}</p>
              )
            ) : (
              <div className="max-h-[400px] space-y-3 overflow-y-auto">
                {announcements.length === 0 ? (
                  <p className="text-sm text-gray-400">{t('portal.notice.noTimeline')}</p>
                ) : (
                  announcements.slice(0, 20).map((item, i) => (
                    <div key={i} className="border-b border-gray-200 pb-3 last:border-0">
                      <div className="flex items-start gap-2">
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.type === 'error' ? 'bg-rose-400' : item.type === 'warning' ? 'bg-amber-400' : 'bg-emerald-400')} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-700">{pickLang(item.content, i18n.language)}</p>
                          {item.publishDate && (
                            <p className="mt-1 text-xs text-gray-400">{new Date(item.publishDate).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {/* Footer */}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setNoticeOpen(false); setNoticeDismissed(true) }}
                className="rounded-lg px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
              >
                {t('portal.notice.dismissToday')}
              </button>
              <button
                type="button"
                onClick={() => setNoticeOpen(false)}
                className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-medium text-gray-900 transition hover:bg-sky-700"
              >
                {t('portal.notice.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Re-export so route files can compose without extra plumbing. */
export const PORTAL_NAV = NAV_ITEMS
export type { NavItem as PortalNavItem }
