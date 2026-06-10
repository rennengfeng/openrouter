import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { KeyRound, Search, Plus, CheckCircle, XCircle, Copy, Eye, EyeOff, Loader2, ArrowRightLeft, Power, PowerOff, Pencil, Trash2, MoreVertical, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { ApiKeysProvider, useApiKeys } from '@/features/keys/components/api-keys-provider'
import { ApiKeysMutateDrawer } from '@/features/keys/components/api-keys-mutate-drawer'
import { CCSwitchDialog } from '@/features/keys/components/dialogs/cc-switch-dialog'
import { deleteApiKey, updateApiKeyStatus } from '@/features/keys/api'
import { quotaUnitsToDollars } from '@/lib/format'
import { Link } from '@tanstack/react-router'
import type { ApiKey } from '@/features/keys/types'

export function PortalTokens() {
  return (
    <ApiKeysProvider>
      <PortalTokensInner />
    </ApiKeysProvider>
  )
}

function PortalTokensInner() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const pageSize = 20

  const { resolveRealKey, resolvedKeys, loadingKeys, markKeyCopied, copiedKeyId } = useApiKeys()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['portal-tokens', page, search],
    queryFn: async () => {
      const params: Record<string, unknown> = { p: page, size: pageSize }
      if (search) params.keyword = search
      const res = await api.get('/api/token/', { params })
      return res.data?.data as { items?: ApiKey[]; total?: number } | undefined
    },
    staleTime: 15_000,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const enabled = items.filter((tk) => tk.status === 1).length
  const disabled = items.filter((tk) => tk.status !== 1).length

  const handleCopyKey = async (token: ApiKey) => {
    let key = resolvedKeys[token.id]
    if (!key) {
      key = (await resolveRealKey(token.id)) ?? ''
    }
    if (key) {
      navigator.clipboard.writeText(key)
      markKeyCopied(token.id)
      toast.success(t('Copied'))
    }
  }

  const [hiddenKeys, setHiddenKeys] = useState<Record<number, boolean>>({})
  const [ccSwitchOpen, setCcSwitchOpen] = useState(false)
  const [ccSwitchKey, setCcSwitchKey] = useState('')

  const handleViewKey = async (token: ApiKey) => {
    if (resolvedKeys[token.id]) {
      setHiddenKeys((prev) => ({ ...prev, [token.id]: !prev[token.id] }))
      return
    }
    await resolveRealKey(token.id)
  }

  const handleDisable = async (token: ApiKey) => {
    const newStatus = token.status === 1 ? 2 : 1
    const res = await updateApiKeyStatus(token.id, newStatus)
    if (res.success) {
      toast.success(newStatus === 1 ? t('Enabled') : t('Disabled'))
      refetch()
    } else {
      toast.error(res.message || t('Operation failed'))
    }
  }

  const handleDelete = async (token: ApiKey) => {
    if (!confirm(t('Are you sure you want to delete token "{{name}}"? This action cannot be undone.', { name: token.name }))) return
    const res = await deleteApiKey(token.id)
    if (res.success) {
      toast.success(t('Deleted'))
      refetch()
    } else {
      toast.error(res.message || t('Delete failed'))
    }
  }

  const handleCcSwitch = async (token: ApiKey) => {
    let key = resolvedKeys[token.id]
    if (!key) {
      key = (await resolveRealKey(token.id)) ?? ''
    }
    if (key) {
      setCcSwitchKey(key)
      setCcSwitchOpen(true)
    }
  }

  const handleEdit = (token: ApiKey) => {
    setEditingKey(token)
    setDrawerOpen(true)
  }

  const handleCreate = () => {
    setEditingKey(null)
    setDrawerOpen(true)
  }

  const formatQuota = (token: ApiKey) => {
    if (token.unlimited_quota) return t('Unlimited')
    const remaining = quotaUnitsToDollars(token.remain_quota)
    const used = quotaUnitsToDollars(token.used_quota)
    const total = remaining + used
    return `$${remaining.toFixed(2)} / $${total.toFixed(2)}`
  }

  const formatModels = (token: ApiKey) => {
    if (!token.model_limits_enabled || !token.model_limits) return t('Unlimited')
    const models = token.model_limits.split(',').filter(Boolean)
    if (models.length <= 2) return models.join(', ')
    return `${models.slice(0, 2).join(', ')} +${models.length - 2}`
  }

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 1: return { text: t('Enabled'), cls: 'bg-green-500/10 text-green-400' }
      case 2: return { text: t('Disabled'), cls: 'bg-red-500/10 text-red-400' }
      case 3: return { text: t('Expired'), cls: 'bg-orange-500/10 text-orange-400' }
      case 4: return { text: t('Exhausted'), cls: 'bg-yellow-500/10 text-yellow-400' }
      default: return { text: t('Unknown'), cls: 'bg-gray-500/10 text-gray-400' }
    }
  }

  const statsCards = [
    { icon: KeyRound, label: t('Total Tokens'), value: total, color: 'text-sky-600', bg: 'from-sky-500/10 to-sky-600/10' },
    { icon: CheckCircle, label: t('Enabled'), value: enabled, color: 'text-green-400', bg: 'from-green-500/20 to-green-600/10' },
    { icon: XCircle, label: t('Disabled'), value: disabled, color: 'text-orange-400', bg: 'from-orange-500/20 to-orange-600/10' },
  ]

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('API Keys')}</h1>
          <p className="mt-1 text-sm text-gray-400">{t('Create and manage your API access tokens for secure API calls')}</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-gray-900 shadow transition hover:bg-sky-500"
        >
          <Plus className="h-4 w-4" />
          {t('Create Token')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${card.bg}`}>
                <Icon className={`h-4.5 w-4.5 ${card.color}`} />
              </div>
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{card.label}</p>
            </div>
          )
        })}
      </div>

      {/* Token List */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        {/* Search */}
        <div className="mb-4 flex items-center justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('Search token name...')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-64 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-sky-400 focus:outline-none"
            />
          </div>
          <span className="text-xs text-gray-400">{t('{{count}} tokens total', { count: total })}</span>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('Loading...')}</p>
        ) : items.length > 0 ? (
          <div className="">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-400">
                  <th className="px-3 py-2.5 text-center">{t('Name')}</th>
                  <th className="px-3 py-2.5 text-center">{t('Status')}</th>
                  <th className="px-3 py-2.5 text-center">{t('Quota')}</th>
                  <th className="px-3 py-2.5 text-center">{t('Group')}</th>
                  <th className="px-3 py-2.5 text-center">{t('Key')}</th>
                  <th className="px-3 py-2.5 text-center">{t('Models')}</th>
                  <th className="px-3 py-2.5 text-center">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((token) => {
                  const status = getStatusLabel(token.status)
                  const fullKey = resolvedKeys[token.id]
                  const isLoadingKey = loadingKeys[token.id]
                  const isCopied = copiedKeyId === token.id
                  const isHidden = !fullKey || hiddenKeys[token.id]
                  return (
                    <tr key={token.id} className="border-b border-gray-100 text-gray-600 transition hover:bg-gray-50">
                      <td className="px-3 py-3 text-center">
                        <span className="font-medium text-gray-900">{token.name}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${status.cls}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">
                        {formatQuota(token)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {token.group ? (
                          <span className="inline-flex items-center rounded-md bg-sky-500/10 px-2 py-0.5 text-xs text-sky-500">
                            {token.group}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <code className="max-w-[200px] truncate rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500">
                            {fullKey && !isHidden ? fullKey : `sk-...${token.key.slice(-4)}`}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleViewKey(token)}
                            className="text-gray-400 transition hover:text-gray-500"
                            title={fullKey && !isHidden ? t('Hide key') : t('Show full key')}
                          >
                            {isLoadingKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : fullKey && !isHidden ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyKey(token)}
                            className={`transition ${isCopied ? 'text-green-400' : 'text-gray-400 hover:text-gray-500'}`}
                            title={t('Copy')}
                          >
                            {isCopied ? (
                              <CheckCircle className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs text-gray-500" title={token.model_limits || ''}>
                          {formatModels(token)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === token.id ? null : token.id)}
                              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-500"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openMenuId === token.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setOpenMenuId(null)}
                                />
                                <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleEdit(token)
                                      setOpenMenuId(null)
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    {t('Edit')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Activity - you can link to a stats page or implement tracking
                                      setOpenMenuId(null)
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                                  >
                                    <Activity className="h-3.5 w-3.5" />
                                    {t('Activity')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDisable(token)
                                      setOpenMenuId(null)
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                                  >
                                    {token.status === 1 ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                    {token.status === 1 ? t('Disable') : t('Enable')}
                                  </button>
                                  <div className="my-1 h-px bg-gray-50" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDelete(token)
                                      setOpenMenuId(null)
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {t('Delete')}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200">
            <div className="text-center">
              <KeyRound className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">{t('No tokens yet')}</p>
              <p className="mt-1 text-xs text-gray-400">{t('Click the button above to create your first token')}</p>
            </div>
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-400">
            <span>{t('{{count}} records total', { count: total })}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-gray-200 px-3 py-1.5 transition hover:bg-gray-50 disabled:opacity-30"
              >
                {t('Previous')}
              </button>
              <span className="text-gray-500">{t('Page {{page}}', { page })}</span>
              <button
                type="button"
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-gray-200 px-3 py-1.5 transition hover:bg-gray-50 disabled:opacity-30"
              >
                {t('Next')}
              </button>
            </div>
          </div>
        )}
      </div>

      <ApiKeysMutateDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) {
            setEditingKey(null)
            refetch()
          }
        }}
        currentRow={editingKey ?? undefined}
      />

      <CCSwitchDialog
        open={ccSwitchOpen}
        onOpenChange={setCcSwitchOpen}
        tokenKey={ccSwitchKey}
      />
    </div>
  )
}
