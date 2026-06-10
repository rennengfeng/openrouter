import { createFileRoute } from '@tanstack/react-router'
import { PortalAbout } from '@/features/frontend-portal/portal-legal'

export const Route = createFileRoute('/portal/about')({
  component: PortalAbout,
})
