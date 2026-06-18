/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bell, Coins, KeyRound, ReceiptText, Send, Wallet } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import { pickLang } from '@/lib/multilang'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useAnnouncements } from '@/features/dashboard/hooks/use-status-data'
import { PortalShell } from './portal-shell'

function getAnnouncementText(content: string | undefined, lang: string, emptyText: string) {
  if (!content) return emptyText
  return pickLang(content, lang ?? 'en').replace(/<[^>]+>/g, '').trim()
}

export function UserHome() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const dayRange = useMemo(() => computeTimeRange(1), [])
  const { items: announcements } = useAnnouncements()

  const dayStatsQuery = useQuery({
    queryKey: ['portal-home-day-stats', dayRange.start_timestamp, dayRange.end_timestamp],
    queryFn: async () =>
      getUserQuotaDates({
        start_timestamp: dayRange.start_timestamp,
        end_timestamp: dayRange.end_timestamp,
        default_time: 'hour',
      }),
    staleTime: 60_000,
  })

  // Recent-30-days tokens (one query, within the backend's 30-day range cap).
  // The user object has no total-tokens field and used_quota is a quota-unit
  // value (≠ token count), so we sum real token_used over the last 30 days.
  const recent30Query = useQuery({
    queryKey: ['portal-home-30d', dayRange.end_timestamp],
    queryFn: async () =>
      getUserQuotaDates({
        start_timestamp: dayRange.end_timestamp - 29 * 24 * 3600,
        end_timestamp: dayRange.end_timestamp,
        default_time: 'day',
      }),
    staleTime: 5 * 60_000,
  })

  const recentTokens = useMemo(
    () =>
      (recent30Query.data?.data ?? []).reduce(
        (sum, item) => sum + (Number(item.token_used) || 0),
        0
      ),
    [recent30Query.data?.data]
  )

  const todayStats = useMemo(() => {
    const rows = dayStatsQuery.data?.data ?? []
    return rows.reduce(
      (acc, item) => {
        acc.requests += Number(item.count) || 0
        acc.tokens += Number(item.token_used) || 0
        acc.quota += Number(item.quota) || 0
        return acc
      },
      { requests: 0, tokens: 0, quota: 0 }
    )
  }, [dayStatsQuery.data?.data])

  const cards = [
    {
      title: t('portal.page.home.card.todayRequests'),
      value: formatNumber(todayStats.requests),
      desc: t('portal.page.home.card.todayRequestsDesc'),
      icon: Send,
    },
    {
      title: t('portal.page.home.card.totalRequests'),
      value: formatNumber(Number(user?.request_count ?? 0)),
      desc: t('portal.page.home.card.totalRequestsDesc'),
      icon: ReceiptText,
    },
    {
      title: t('portal.page.home.card.todayTokens'),
      value: formatNumber(todayStats.tokens),
      desc: t('portal.page.home.card.todayTokensDesc'),
      icon: KeyRound,
    },
    {
      title: t('portal.page.home.card.recentTokens'),
      value: formatNumber(recentTokens),
      desc: t('portal.page.home.card.recentTokensDesc'),
      icon: Coins,
    },
    {
      title: t('portal.page.home.card.todaySpend'),
      value: formatQuota(todayStats.quota),
      desc: t('portal.page.home.card.todaySpendDesc'),
      icon: Wallet,
    },
    {
      title: t('portal.page.home.card.totalSpend'),
      value: formatQuota(Number(user?.used_quota ?? 0)),
      desc: t('portal.page.home.card.totalSpendDesc'),
      icon: Wallet,
    },
  ]

  return (
    <PortalShell>
      <section className='space-y-4 pt-3'>
        <div>
          <h1 className='text-3xl leading-tight font-bold'>
            {t('portal.page.home.welcomeName', { name: user?.username || t('User') })}
          </h1>
          <p className='text-muted-foreground mt-2 text-sm'>
            {t('portal.page.home.lead')}
          </p>
        </div>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]'>
          <div className='grid gap-3 sm:grid-cols-2'>
            {cards.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title} className='rounded-xl'>
                  <CardHeader className='pb-2'>
                    <div className='flex items-center justify-between'>
                      <CardTitle className='text-muted-foreground text-xs font-medium'>
                        {item.title}
                      </CardTitle>
                      <Icon className='text-muted-foreground size-4' />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-semibold'>{item.value}</div>
                    <p className='text-muted-foreground mt-1 text-xs'>{item.desc}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card className='rounded-xl'>
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between'>
                <CardTitle className='flex items-center gap-2 text-sm'>
                  <Bell className='size-4' />
                  {t('portal.page.home.announcements')}
                </CardTitle>
                <span className='text-muted-foreground text-xs'>
                  {t('portal.page.home.noUpdates')}
                </span>
              </div>
            </CardHeader>
            <CardContent className='space-y-3'>
              {announcements.length > 0 ? (
                announcements.slice(0, 5).map((item, index) => (
                  <div key={`${item.id ?? 'notice'}-${index}`} className='rounded-lg border p-3 text-sm'>
                    {getAnnouncementText(
                      item.content,
                      i18n.language,
                      t('portal.page.home.noNotice')
                    )}
                  </div>
                ))
              ) : (
                <div className='text-muted-foreground rounded-lg border p-3 text-sm'>
                  {t('portal.page.home.noNoticeHint')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </PortalShell>
  )
}
