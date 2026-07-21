import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { PortalLayout } from '@/features/frontend-portal/portal-layout'
import { PortalTopBar } from '@/features/frontend-portal/portal-top-bar'
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
    if (!auth.user || !auth.accessToken) {
      try {
        const res = await getSelf()
        if (res?.success && res.data) {
          auth.setUser(res.data)
        }
      } catch {
        /* 视为未登录，下面统一处理 */
      }
    }

    const { user, accessToken } = useAuthStore.getState().auth

    // 未登录
    if (!user || !accessToken) {
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

  // 未登录访客（仅会停留在公开模型广场）使用与「关于/隐私」页一致的锁定顶栏
  // （PortalTopBar：左 logo / 右 中EN RU + 登录，左右分居、固定不变）
  if (!user) {
    return (
      <PublicLayout
        header={<PortalTopBar />}
        headerProps={{ showNavigation: false, lockHeader: true }}
      >
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
