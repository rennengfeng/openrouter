import { createFileRoute } from '@tanstack/react-router'
import { PortalPrivacy } from '@/features/frontend-portal/portal-legal'

export const Route = createFileRoute('/portal/privacy')({
  component: PortalPrivacy,
})
