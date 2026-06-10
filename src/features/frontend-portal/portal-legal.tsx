import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '@/lib/api'

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function PortalContentPage({ endpoint, titleKey }: { endpoint: string; titleKey: string }) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['portal-content', endpoint],
    queryFn: async () => {
      const res = await api.get(endpoint, { skipErrorHandler: true } as Record<string, unknown>)
      return typeof res.data?.data === 'string' ? res.data.data : ''
    },
    staleTime: 120_000,
  })

  const content = (data ?? '').trim()

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t(titleKey)}</h1>
      {isLoading ? (
        <p className="text-sm text-gray-400">{t('Loading...')}</p>
      ) : !content ? (
        <p className="text-sm text-gray-400">{t('No content yet')}</p>
      ) : isValidUrl(content) ? (
        <iframe
          src={content}
          className="h-[72vh] w-full rounded-lg border border-gray-200"
          title={t(titleKey)}
        />
      ) : isLikelyHtml(content) ? (
        <div
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <div className="prose prose-sm max-w-none text-gray-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}

export function PortalAbout() {
  return <PortalContentPage endpoint="/api/about" titleKey="About" />
}

export function PortalPrivacy() {
  return <PortalContentPage endpoint="/api/privacy_policy" titleKey="Privacy" />
}

export function PortalTerms() {
  return <PortalContentPage endpoint="/api/user_agreement" titleKey="Terms of Service" />
}
