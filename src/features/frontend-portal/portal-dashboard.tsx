import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { useStatus } from '@/hooks/use-status'
import { getSelf } from '@/lib/api'
import { formatQuota, formatNumber } from '@/lib/format'
import { pickLang } from '@/lib/multilang'
import { CopyButton } from '@/components/copy-button'
import { BarChart3, Activity, Bell, Globe } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import dayjs from 'dayjs'

export function PortalDashboard() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const setUser = useAuthStore((s) => s.auth.setUser)
  const { status } = useStatus()

  useEffect(() => {
    getSelf().then((res) => {
      if (res.success && res.data) {
        setUser(res.data as typeof user)
      }
    }).catch(() => {})
  }, [setUser])

  const source = (status?.data ?? status) as Record<string, unknown> | null | undefined
  const announcementsEnabled = source?.announcements_enabled !== false
  const announcements = (announcementsEnabled ? source?.announcements : []) as Array<{ content: string; publishDate: string; type?: string }> | undefined

  const apiInfoEnabled = source?.api_info_enabled !== false
  const apiInfoItems = (apiInfoEnabled ? source?.api_info : []) as Array<{ url: string; route: string; description: string; color: string }> | undefined
  const items = apiInfoItems ?? []

  const displayName = user?.display_name || user?.username || 'User'

  return (
    <div className="flex h-full flex-col overflow-y-auto no-scrollbar">
      {/* Top: Simplified user info banner */}
      <div className="shrink-0 px-5 pt-2 pb-3">
        <div className="overflow-hidden rounded-lg border bg-card">
          {/* Profile info - simplified */}
          <div className="px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{displayName}</h2>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  @{user?.username || '-'}
                </div>
              </div>
            </div>
            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3">
              <div>
                <p className="text-xs text-muted-foreground">{t('Current Balance')}</p>
                <p className="font-mono text-2xl font-bold tabular-nums">{formatQuota(user?.quota ?? 0)}</p>
              </div>
              <div className="ml-auto flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('Total Usage')}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums">{formatQuota(user?.used_quota ?? 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('Request Count')}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums">{formatNumber(user?.request_count ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: API Info + Announcements */}
      <div className="min-h-0 flex-1 px-5 pb-3">
        <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-[4fr_6fr]">
          {/* Left: API Info */}
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{t('portal.page.home.discoverAPI')}</h3>
            </div>
            <div className="overflow-y-auto p-3 no-scrollbar" style={{ maxHeight: 'calc(100% - 44px)' }}>
              {items.length > 0 ? (
                <div className="space-y-2.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 p-3 transition hover:border-primary/30 hover:bg-muted/40"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${item.color}20` }}
                      >
                        <Globe className="h-4 w-4" style={{ color: item.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{pickLang(item.description, i18n.language)}</p>
                        <p className="truncate text-sm text-muted-foreground">{item.url}</p>
                        {item.route && (
                          <p className="mt-1 break-words text-sm text-muted-foreground">
                            {pickLang(item.route, i18n.language)}
                          </p>
                        )}
                      </div>
                      <CopyButton
                        value={item.url}
                        variant="ghost"
                        size="sm"
                        className="size-7 shrink-0 p-0"
                        iconClassName="size-3.5"
                        tooltip={t('Copy URL')}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('portal.page.home.noModels')}</p>
              )}
            </div>
          </div>

          {/* Right: Announcements */}
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{t('portal.page.home.latestNotice')}</h3>
            </div>
            <div className="overflow-y-auto p-4 no-scrollbar" style={{ maxHeight: 'calc(100% - 44px)' }}>
              {announcements && announcements.length > 0 ? (
                <div className="space-y-3">
                  {announcements.map((ann, idx) => (
                    <div key={idx} className="rounded-lg border border-border/40 bg-muted/20 p-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {pickLang(ann.content, i18n.language)}
                        </ReactMarkdown>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {dayjs(ann.publishDate).format('YYYY-MM-DD HH:mm')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('portal.page.home.noNotice')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
