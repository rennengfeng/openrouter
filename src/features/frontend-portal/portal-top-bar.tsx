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
/**
 * PortalTopBar — the simplified portal-style top bar (logo + site name +
 * zh/en/ru language toggle + avatar dropdown). Mirrors the header inside
 * PortalLayout but is self-contained, so it can be reused on standalone
 * public pages (About / Privacy / Terms). It intentionally omits the
 * "Help Docs" button and the notification bell.
 */
import { type CSSProperties } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LogOut, Settings, User, Wallet } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useStatus } from '@/hooks/use-status'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function useBrand() {
  const { status } = useStatus()
  const source = (status?.data ?? status) as
    | Record<string, unknown>
    | null
    | undefined
  const name =
    typeof source?.system_name === 'string' && source.system_name.trim()
      ? (source.system_name as string).trim()
      : 'New API'
  const logo =
    typeof source?.logo === 'string' && source.logo.trim()
      ? (source.logo as string)
      : '/logo.png'
  return { name, logo }
}

export function PortalTopBar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const brand = useBrand()
  const authStore = useAuthStore((s) => s.auth)
  const user = authStore.user

  const currentLang = i18n.language?.startsWith('ru')
    ? 'ru'
    : i18n.language?.startsWith('zh')
      ? 'zh'
      : 'en'
  const changeLang = (code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem('i18nextLng', code)
  }

  const initial = user?.username
    ? user.username.charAt(0).toUpperCase()
    : user?.display_name
      ? user.display_name.charAt(0).toUpperCase()
      : 'U'

  const handleSignOut = () => {
    authStore.reset()
    navigate({ to: '/sign-in' })
  }

  return (
    <header
      className="z-30 flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3 text-gray-900"
      style={{ colorScheme: 'light' } as CSSProperties}
    >
      <Link
        to="/"
        className="flex items-center gap-2 text-xl font-bold text-gray-900"
      >
        <img src={brand.logo} alt={brand.name} className="h-7 w-7 rounded" />
        <span>{brand.name}</span>
      </Link>

      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-0.5 rounded-md border border-gray-200 p-0.5"
          title={t('portal.lang.toggle')}
        >
          {[
            { c: 'zh', l: '中' },
            { c: 'en', l: 'EN' },
            { c: 'ru', l: 'RU' },
          ].map((o) => (
            <button
              key={o.c}
              type="button"
              onClick={() => changeLang(o.c)}
              className={`rounded px-2 py-1 text-xs font-medium transition ${currentLang === o.c ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {o.l}
            </button>
          ))}
        </div>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 rounded-full outline-none cursor-pointer"
              title={user?.username || 'profile'}
            >
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-sm font-semibold text-gray-900 shadow">
                {initial}
              </div>
              <span className="text-sm text-gray-700 hidden sm:inline">
                {user?.username || user?.display_name || 'User'}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-48">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">
                  {user?.username || user?.display_name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.email || ''}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: '/portal/settings' })}>
                <User className="mr-2 h-4 w-4" />
                {t('portal.profile')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate({ to: '/portal/topup' })}>
                <Wallet className="mr-2 h-4 w-4" />
                {t('portal.wallet')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate({ to: '/portal/settings' })}>
                <Settings className="mr-2 h-4 w-4" />
                {t('portal.settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4 text-red-400" />
                <span className="text-red-400">{t('portal.signout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            to="/sign-in"
            className="inline-flex items-center rounded-lg bg-sky-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-sky-500"
          >
            {t('Sign in')}
          </Link>
        )}
      </div>
    </header>
  )
}
