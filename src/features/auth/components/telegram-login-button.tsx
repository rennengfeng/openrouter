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
  /** When true, block clicks (e.g. legal consent not yet given) */
  disabled?: boolean
  /** Called when the user clicks while disabled (e.g. to show a hint) */
  onDisabledClick?: () => void
  label: string
  /** 'write' to request the ability to send messages, omit otherwise */
  requestAccess?: 'write'
}

// Telegram's widget invokes a global callback by name. Keep a stable, unique
// name per mounted widget so multiple instances don't clobber each other.
let telegramCallbackSeq = 0

/**
 * A Telegram login button that looks exactly like the other OAuth buttons
 * (outline style, icon + label) but is driven by Telegram's OFFICIAL widget.
 *
 * How it stays clickable AND custom-styled:
 *  - The visible layer is our own outline <Button>.
 *  - Telegram's official widget is injected once and overlaid on top at
 *    opacity 0. Opacity-0 elements still receive pointer events, so clicking
 *    the (invisible) Telegram button triggers its auth popup.
 *  - Crucially we do NOT apply any CSS transform to the iframe. Scaling a
 *    cross-origin iframe breaks click-coordinate mapping (that was the cause of
 *    the earlier "can't click" bug). At natural size the click lands correctly.
 *  - The widget is rendered with the largest size and centered so its clickable
 *    area covers the button's center (where the icon + label sit).
 *
 * Legal-consent gating: while `disabled`, the overlay is click-through
 * (pointer-events: none), the visible button shows its disabled state, and a
 * separate transparent blocker calls `onDisabledClick` (e.g. a toast).
 *
 * Note: the bot must have its domain configured via BotFather (/setdomain),
 * and the page must be served over HTTPS on that exact domain — otherwise the
 * widget silently refuses to render.
 */
export function TelegramLoginButton({
  botName,
  onAuth,
  disabled = false,
  onDisabledClick,
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

    return () => {
      container.innerHTML = ''
      delete (window as unknown as Record<string, unknown>)[callbackName]
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

      {/* Official Telegram widget overlay — transparent, natural size, centered.
          No transform, so clicks map correctly. Loaded once (no flicker). */}
      <div
        ref={overlayRef}
        aria-hidden='true'
        className='absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-lg'
        style={{
          opacity: 0,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      />

      {/* Consent gate: transparent click-blocker shown only while disabled */}
      {disabled && (
        <button
          type='button'
          aria-label='Telegram login disabled'
          onClick={onDisabledClick}
          className='absolute inset-0 z-20 cursor-not-allowed bg-transparent'
        />
      )}
    </div>
  )
}
