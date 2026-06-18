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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Skeleton } from '@/components/ui/skeleton'
import { LanguageSwitcher } from '@/components/language-switcher'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='relative grid h-svh max-w-none bg-background text-foreground'>
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(99,102,241,0.06),transparent_50%),radial-gradient(circle_at_70%_60%,rgba(139,92,246,0.05),transparent_50%)]" />

      {/* Header: brand (top-left) — links to home, consistent with other pages */}
      <Link
        to='/'
        className='absolute top-6 left-6 z-20 flex items-center gap-2.5 transition-opacity hover:opacity-80 sm:top-8 sm:left-8'
      >
        <div className='relative h-8 w-8'>
          {loading ? (
            <Skeleton className='absolute inset-0 rounded-lg' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='h-8 w-8 rounded-lg object-cover'
            />
          )}
        </div>
        {loading ? (
          <Skeleton className='h-6 w-28' />
        ) : (
          <h1 className='text-foreground text-xl font-bold tracking-tight'>
            {systemName}
          </h1>
        )}
      </Link>

      {/* Header: language switcher (top-right) */}
      <div className='absolute top-6 right-6 z-20 sm:top-8 sm:right-8'>
        <LanguageSwitcher />
      </div>

      {/* Content. The full-bleed container must NOT swallow clicks meant for the
          absolutely-positioned brand/language-switcher underneath it, so it is
          click-through except for the card itself. */}
      <div className='container pointer-events-none relative z-10 flex items-center justify-center pt-16 sm:pt-0'>
        <div className='pointer-events-auto mx-auto flex w-full flex-col justify-center space-y-6 px-6 py-8 sm:w-[440px]'>
          <div className='bg-card rounded-2xl border p-8 shadow-xl'>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
