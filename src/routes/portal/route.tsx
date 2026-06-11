import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { PortalLayout } from '@/features/frontend-portal/portal-layout'
import { PublicLayout } from '@/components/layout'
import { useAuthStore } from '@/stores/auth-store'
import { getSelf } from '@/lib/api'
import { ROLE } from '@/lib/roles'

// 模型广场对未登录访客公开；其余 portal 子路由仍需登录
function isPublicPortalPath(pathname: string) {
  return pathname === '/portal/models' || pathname.startsWith('/portal/models/')
}

export const Route = createFileRoute('/portal')({
  beforeLoad: async ({ location }) => {
    const isPublic = isPublicPortalPath(location.pathname)
    const { auth } = useAuthStore.getState()

    // 尝试用 cookie 恢复登录态
    if (!auth.user) {
      try {
        const res = await getSelf()
        if (res?.success && res.data) {
          auth.setUser(res.data)
        }
      } catch {
        /* 视为未登录，下面统一处理 */
      }
    }

    const user = useAuthStore.getState().auth.user

    // 未登录
    if (!user) {
      if (isPublic) return // 公开模型广场
      useAuthStore.getState().auth.reset()
      throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    }

    // 管理员走原版 /dashboard（公开模型广场除外）
    if (user.role >= ROLE.ADMIN && !isPublic) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: PortalRoute,
})

function PortalRoute() {
  const user = useAuthStore((s) => s.auth.user)

  // 未登录访客（仅会停留在公开模型广场）使用二开精简公共外壳，无侧边栏
  if (!user) {
    return (
      <PublicLayout headerProps={{ showNavigation: false }}>
        <Outlet />
      </PublicLayout>
    )
  }

  return (
    <PortalLayout>
      <Outlet />
    </PortalLayout>
  )
}
