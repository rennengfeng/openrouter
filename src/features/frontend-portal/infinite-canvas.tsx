import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
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
    <div className="h-full min-h-[640px] overflow-hidden rounded-lg border bg-background">
      <iframe
        title={t('portal.canvas')}
        src={canvasUrl}
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write; fullscreen"
        referrerPolicy="no-referrer"
      />
    </div>
  )
}
