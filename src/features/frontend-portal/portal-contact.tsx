import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'

type ContactEntry = {
  type: 'docs' | 'qq_group' | 'qq_service' | 'telegram' | 'wechat' | 'custom'
  title: string
  description: string
  action?: string
  link?: string
}

const DEFAULT_CONTACTS: ContactEntry[] = [
  {
    type: 'docs',
    title: 'portal.page.contact.docs.title',
    description: 'portal.page.contact.docs.desc',
    action: 'portal.page.contact.action',
  },
  {
    type: 'qq_group',
    title: 'portal.page.contact.qqGroup.title',
    description: 'portal.page.contact.qqGroup.desc',
  },
  {
    type: 'qq_service',
    title: 'portal.page.contact.qqService.title',
    description: 'portal.page.contact.qqService.desc',
  },
  {
    type: 'telegram',
    title: 'portal.page.contact.tgGroup.title',
    description: 'portal.page.contact.tgGroup.desc',
    action: 'portal.page.contact.action',
  },
]

export function PortalContact() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const source = (status?.data ?? status) as Record<string, unknown> | null | undefined

  const docsUrl =
    typeof source?.docs_link === 'string' && (source.docs_link as string).trim()
      ? (source.docs_link as string)
      : ''

  const contacts = DEFAULT_CONTACTS.map((c) => {
    if (c.type === 'docs' && docsUrl) {
      return { ...c, link: docsUrl }
    }
    return c
  })

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 backdrop-blur">
        <p className="text-sm text-gray-500">
          {t('portal.page.contact.needHelp')}
        </p>
        <p className="text-sm text-gray-500">
          {t('portal.page.contact.helpDesc')}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 backdrop-blur">
        <h2 className="mb-5 text-lg font-semibold text-gray-900">{t('portal.contact')}</h2>
        <div className="space-y-4">
          {contacts.map((c) => (
            <div
              key={c.type}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/3 px-5 py-4"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{t(c.title)}</p>
                <p className="text-xs text-gray-500">{t(c.description)}</p>
              </div>
              {c.action ? (
                c.link ? (
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-lg bg-orange-500/90 px-3 py-1.5 text-xs font-medium text-gray-900 transition hover:bg-orange-500"
                  >
                    {t(c.action)}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg bg-orange-500/90 px-3 py-1.5 text-xs font-medium text-gray-900 transition hover:bg-orange-500"
                  >
                    {t(c.action)}
                  </button>
                )
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
