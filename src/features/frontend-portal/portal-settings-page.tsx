import { useAuthStore } from '@/stores/auth-store'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LogOut, Shield } from 'lucide-react'

export function PortalSettings() {
  const { t } = useTranslation()
  const auth = useAuthStore((s) => s.auth)
  const navigate = useNavigate()

  const handleSignOut = () => {
    auth.reset()
    navigate({ to: '/sign-in' })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 backdrop-blur">
        <h2 className="text-lg font-semibold text-gray-900">
          {t('portal.page.settings.title')}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('portal.page.settings.subtitle')}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 backdrop-blur">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Shield className="h-4 w-4" /> {t('portal.page.settings.security')}
        </h3>
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 rounded-lg bg-red-500/80 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-red-500"
        >
          <LogOut className="h-4 w-4" />
          {t('portal.signout')}
        </button>
      </div>
    </div>
  )
}
