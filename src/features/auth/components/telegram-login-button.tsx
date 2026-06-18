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
import { useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
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

type TelegramLoginButtonProps = {
  botName: string
  onAuth: (data: TelegramAuthData) => void
  /** Disable the button (e.g. legal consent not yet given) */
  disabled?: boolean
  label: string
  /** 'write' to request the ability to send messages, omit otherwise */
  requestAccess?: 'write'
}

// Telegram's widget invokes a global callback by name. Keep a stable, unique
// name per mounted widget so multiple instances don't clobber each other.
let telegramCallbackSeq = 0

/**
 * A Telegram login button that visually matches the other OAuth buttons
 * (outline style), while still using Telegram's official auth widget.
 *
 * Technique: a styled outline button is always rendered as the visible layer.
 * The real Telegram widget iframe is injected once into a transparent overlay
 * stacked on top of the button (so toggling consent never re-loads it — no
 * flicker). The transparent iframe is scaled up to cover the whole button so
 * a click anywhere triggers Telegram's auth popup. When `disabled`, the overlay
 * is click-through (pointer-events: none) and the button shows its disabled
 * state, exactly like the other OAuth providers.
 *
 * Note: the bot must have its domain configured via BotFather (/setdomain),
 * and the page must be served over HTTPS on that exact domain — otherwise the
 * widget silently refuses to render.
 */
export function TelegramLoginButton({
  botName,
  onAuth,
  disabled = false,
  label,
  requestAccess,
}: TelegramLoginButtonProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const onAuthRef = useRef(onAuth)
  onAuthRef.current = onAuth

  useEffect(() => {
    if (!botName || !overlayRef.current) return

    const container = overlayRef.current
    const callbackName = `__onTelegramAuth_${telegramCallbackSeq++}`

    ;(window as unknown as Record<string, unknown>)[callbackName] = (
      user: TelegramAuthData
    ) => {
      onAuthRef.current(user)
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', `${callbackName}(user)`)
    script.setAttribute('data-request-access', requestAccess ?? '')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-radius', '8')

    container.appendChild(script)

    // Once Telegram injects its iframe, scale it so its (invisible) clickable
    // area exactly covers the button beneath it. We measure both boxes and use
    // the larger ratio so there are no dead zones, while keeping the scale as
    // small as possible — large scale factors break click-coordinate mapping
    // on cross-origin iframes.
    const fitIframe = (iframe: HTMLIFrameElement) => {
      const iw = iframe.offsetWidth || 1
      const ih = iframe.offsetHeight || 1
      const cw = container.clientWidth || iw
      const ch = container.clientHeight || ih
      const scale = Math.max(cw / iw, ch / ih) * 1.15
      iframe.style.transformOrigin = 'center'
      iframe.style.transform = `scale(${scale})`
    }

    const observer = new MutationObserver(() => {
      const iframe = container.querySelector<HTMLIFrameElement>('iframe')
      if (iframe) {
        // The iframe may report 0 size until Telegram finishes rendering; retry.
        if (iframe.offsetWidth > 0) {
          fitIframe(iframe)
          observer.disconnect()
        } else {
          iframe.addEventListener('load', () => fitIframe(iframe), {
            once: true,
          })
          observer.disconnect()
        }
      }
    })
    observer.observe(container, { childList: true, subtree: true })

    return () => {
      container.innerHTML = ''
      delete (window as unknown as Record<string, unknown>)[callbackName]
      observer.disconnect()
    }
  }, [botName, requestAccess])

  return (
    <div className='relative w-full'>
      {/* Visible styled button — matches the other OAuth providers */}
      <Button
        variant='outline'
        type='button'
        disabled={disabled}
        className='h-11 w-full justify-center gap-2 rounded-lg'
      >
        <Send className='h-4 w-4' />
        {label}
      </Button>

      {/* Transparent Telegram widget overlay (click target). Loaded once. */}
      <div
        ref={overlayRef}
        aria-hidden='true'
        className='absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-lg'
        style={{
          opacity: 0,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      />
    </div>
  )
}
