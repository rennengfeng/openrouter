import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { ExternalLink, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useActiveChatKey } from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { resolveChatUrl } from '@/features/chat/lib/chat-links'
import { cn } from '@/lib/utils'
import { isCanvasPreset } from './canvas-link'

export function InfiniteCanvas() {
  const { t } = useTranslation()
  const { chatPresets, serverAddress } = useChatPresets()
  const { data: activeKey, error: keyError, isLoading } = useActiveChatKey(true)

  const canvasTemplate = useMemo(() => {
    return chatPresets.find(isCanvasPreset)?.url ?? ''
  }, [chatPresets])

  const canvasUrl = useMemo(() => {
    if (!activeKey) return ''
    return resolveChatUrl({
      template: canvasTemplate,
      apiKey: activeKey,
      serverAddress,
    })
  }, [activeKey, canvasTemplate, serverAddress])

  if (isLoading) {
    return (
      <div className="grid h-full min-h-[560px] place-items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('portal.canvas.loading')}</span>
        </div>
      </div>
    )
  }

  if (!canvasTemplate) {
    return (
      <div className="grid h-full min-h-[560px] place-items-center">
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {t('portal.canvas.notConfigured')}
        </p>
      </div>
    )
  }

  if (keyError || !activeKey) {
    return (
      <div className="grid h-full min-h-[560px] place-items-center">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t('portal.canvas.noToken')}
          </p>
          <Link
            to="/portal/tokens"
            className={cn(
              'inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition',
              'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {t('portal.canvas.openTokens')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/80 shadow-sm backdrop-blur">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{t('portal.canvas')}</p>
            <p className="truncate text-xs text-muted-foreground">{canvasTemplate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={canvasUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-medium transition',
              'border-border bg-background text-foreground hover:bg-muted'
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('Open in new tab')}
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-medium transition',
              'border-border bg-background text-foreground hover:bg-muted'
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('Refresh')}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-background">
        <iframe
          title={t('portal.canvas')}
          src={canvasUrl}
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write; fullscreen"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  )
}
