import { createFileRoute } from '@tanstack/react-router'
import { PortalTerms } from '@/features/frontend-portal/portal-legal'

export const Route = createFileRoute('/portal/terms')({
  component: PortalTerms,
})
