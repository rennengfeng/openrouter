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
import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type TelegramAuthData = {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date?: number | string
  hash: string
  [key: string]: unknown
}

type TelegramLoginOptions = {
  bot_id: string | number
  request_access?: string
  lang?: string
}

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth: (
          options: TelegramLoginOptions,
          callback: (user: TelegramAuthData | false) => void
        ) => void
      }
    }
  }
}

type TelegramLoginButtonProps = {
  /** Numeric bot id (the part before ':' in the bot token). */
  botId: string
  onAuth: (data: TelegramAuthData) => void
  /** When true, show a disabled look and surface onDisabledClick instead of auth */
  disabled?: boolean
  /** Called when the user clicks while disabled (e.g. to show a hint) */
  onDisabledClick?: () => void
  label: string
  /** 'write' to request the ability to send messages, omit otherwise */
  requestAccess?: 'write'
  /** UI language to localize the Telegram auth popup (e.g. 'en', 'zh') */
  lang?: string
}

const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22'

// Load telegram-widget.js exactly once across the app. We only need the script
// to define `window.Telegram.Login.auth`; we do NOT render Telegram's own blue
// button. Our styled button calls auth() directly, which opens Telegram's
// official popup — fully reliable and fully custom-styled.
let widgetPromise: Promise<void> | null = null
function ensureTelegramWidget(): Promise<void> {
  if (widgetPromise) return widgetPromise
  widgetPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('no document'))
      return
    }
    if (window.Telegram?.Login) {
      resolve()
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${WIDGET_SRC}"]`
    )
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('load failed')))
      return
    }
    const script = document.createElement('script')
    script.src = WIDGET_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('load failed'))
    document.head.appendChild(script)
  })
  return widgetPromise
}

/**
 * Telegram login button that matches the other OAuth buttons (outline style,
 * icon + label) and reliably triggers Telegram's official auth popup.
 *
 * Implementation: we load telegram-widget.js once (which defines
 * `window.Telegram.Login.auth`) but never render Telegram's blue widget button.
 * Our own <Button> calls `Telegram.Login.auth({ bot_id }, cb)` synchronously on
 * click, opening Telegram's official popup. This avoids the transparent-overlay
 * clickjacking trick (blocked by browsers/Telegram) entirely.
 *
 * Requires the bot's numeric id (exposed by the backend status as
 * `telegram_bot_id`) and the bot's domain configured via BotFather (/setdomain)
 * on the exact HTTPS host.
 */
export function TelegramLoginButton({
  botId,
  onAuth,
  disabled = false,
  onDisabledClick,
  label,
  requestAccess,
  lang,
}: TelegramLoginButtonProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    ensureTelegramWidget()
      .then(() => {
        if (mounted) setReady(true)
      })
      .catch(() => {
        /* widget failed to load; button click will no-op */
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleClick = () => {
    if (disabled) {
      onDisabledClick?.()
      return
    }
    const login = window.Telegram?.Login
    if (!login || !ready) return
    // Must be called synchronously within the click gesture so the popup isn't
    // blocked.
    login.auth(
      {
        bot_id: botId,
        ...(requestAccess ? { request_access: requestAccess } : {}),
        ...(lang ? { lang } : {}),
      },
      (user) => {
        if (user) onAuth(user)
      }
    )
  }

  return (
    <Button
      variant='outline'
      type='button'
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        'h-11 w-full justify-center gap-2 rounded-lg',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <Send className='h-4 w-4' />
      {label}
    </Button>
  )
}
