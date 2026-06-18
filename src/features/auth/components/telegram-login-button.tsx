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
  /** Callback fired before the Telegram popup opens — return false to cancel */
  onBeforeAuth?: () => boolean
  /** 'write' to request the ability to send messages, omit otherwise */
  requestAccess?: 'write'
  /** Telegram widget button size */
  buttonSize?: 'large' | 'medium' | 'small'
  /** corner radius of the widget button, in px */
  cornerRadius?: number
  /** show the user's avatar next to the button */
  showUserPhoto?: boolean
  className?: string
}

// Telegram's widget invokes a global callback by name. Keep a stable, unique
// name per mounted widget so multiple instances don't clobber each other.
let telegramCallbackSeq = 0

/**
 * Renders the official Telegram Login Widget by injecting
 * https://telegram.org/js/telegram-widget.js. When the user authorizes, the
 * widget calls our global callback with the signed auth payload, which we hand
 * back to the parent via `onAuth`.
 *
 * `onBeforeAuth` is called before opening the popup — return false to cancel.
 *
 * Note: the bot must have its domain configured via BotFather (/setdomain),
 * and the page must be served over HTTPS on that exact domain — otherwise the
 * widget silently refuses to render.
 */
export function TelegramLoginButton({
  botName,
  onAuth,
  onBeforeAuth,
  requestAccess,
  buttonSize = 'large',
  cornerRadius,
  showUserPhoto = false,
  className,
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onAuthRef = useRef(onAuth)
  const onBeforeAuthRef = useRef(onBeforeAuth)
  onAuthRef.current = onAuth
  onBeforeAuthRef.current = onBeforeAuth

  useEffect(() => {
    if (!botName || !containerRef.current) return

    const container = containerRef.current
    const callbackName = `__onTelegramAuth_${telegramCallbackSeq++}`

    ;(window as unknown as Record<string, unknown>)[callbackName] = (
      user: TelegramAuthData
    ) => {
      // Intercept: check onBeforeAuth first
      if (onBeforeAuthRef.current && !onBeforeAuthRef.current()) {
        return
      }
      onAuthRef.current(user)
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', buttonSize)
    script.setAttribute('data-onauth', `${callbackName}(user)`)
    script.setAttribute('data-request-access', requestAccess ?? '')
    script.setAttribute('data-userpic', showUserPhoto ? 'true' : 'false')
    if (typeof cornerRadius === 'number') {
      script.setAttribute('data-radius', String(cornerRadius))
    }

    container.appendChild(script)

    return () => {
      container.innerHTML = ''
      delete (window as unknown as Record<string, unknown>)[callbackName]
    }
  }, [botName, buttonSize, cornerRadius, requestAccess, showUserPhoto])

  return <div ref={containerRef} className={className} />
}
