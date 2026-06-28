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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Copy, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const OPTION_KEY = 'dashscope_pricing.models'

const DEFAULT_TEMPLATE = {
  'your-dashscope-video-model': {
    unit: 'second',
    price_expr:
      'param("resolution") == "4k" ? tier("4k", 0.0) : param("resolution") == "2k" ? tier("2k", 0.0) : param("resolution") == "1080p" ? tier("1080p", 0.0) : param("resolution") == "720p" ? tier("720p", 0.0) : tier("default", 0.0)',
  },
  'your-dashscope-image-model': {
    unit: 'image',
    price_expr:
      'param("resolution") == "1080p" ? tier("1080p", 0.0) : tier("default", 0.0)',
  },
}

type PricingRule = {
  field: string
  operator: '==' | '!='
  value: string
  amount: string
}

type PricingModel = {
  unit: 'second' | 'image'
  rules: PricingRule[]
}

const FIELD_OPTIONS = [
  { value: 'resolution', label: 'resolution' },
  { value: 'raw_resolution', label: 'raw_resolution' },
  { value: 'size', label: 'size' },
  { value: 'duration', label: 'duration' },
  { value: 'image_count', label: 'image_count' },
  { value: 'model', label: 'model' },
  { value: 'action', label: 'action' },
]

const VALUE_OPTIONS = ['480p', '720p', '1080p', '2k', '4k']

const UNIT_OPTIONS: Array<{ value: PricingModel['unit']; label: string }> = [
  { value: 'second', label: 'second' },
  { value: 'image', label: 'image' },
]

function createDefaultRule(): PricingRule {
  return {
    field: 'resolution',
    operator: '==',
    value: '1080p',
    amount: '0',
  }
}

function normalizePricingConfig(raw: string): Record<string, PricingModel> {
  try {
    const parsed = JSON.parse(raw || '{}') as Record<string, unknown>
    const normalized: Record<string, PricingModel> = {}
    Object.entries(parsed).forEach(([model, config]) => {
      if (!config || typeof config !== 'object' || Array.isArray(config)) return
      const typed = config as Record<string, unknown>
      const unit =
        typed.unit === 'image' || typed.unit === 'second' ? typed.unit : 'second'
      const rules: PricingRule[] = Array.isArray(typed.rules)
        ? typed.rules
            .map((item) => item as Record<string, unknown>)
            .filter(Boolean)
            .map((item) => ({
              field:
                typeof item.field === 'string' && item.field
                  ? item.field
                  : 'resolution',
              operator: item.operator === '!=' ? '!=' : '==',
              value: typeof item.value === 'string' ? item.value : '1080p',
              amount: String(item.amount ?? '0'),
            }))
        : []
      normalized[model] = {
        unit,
        rules: rules.length > 0 ? rules : [createDefaultRule()],
      }
    })
    return normalized
  } catch {
    return {}
  }
}

function buildPriceExpr(rule: PricingRule) {
  return `param(${JSON.stringify(rule.field)}) ${rule.operator} ${JSON.stringify(rule.value)} ? tier(${JSON.stringify(rule.value)}, ${Number(rule.amount || 0)}) : `
}

function serializePricingModel(model: PricingModel) {
  const expr = model.rules
    .map((rule) => buildPriceExpr(rule))
    .join('')
  return {
    unit: model.unit,
    price_expr: `${expr}tier("default", 0.0)`,
  }
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function normalizeJsonText(value: string | undefined) {
  const raw = (value ?? '').trim()
  if (!raw) return '{}'
  try {
    return formatJson(JSON.parse(raw))
  } catch {
    return raw
  }
}

type DashScopePricingSettingsProps = {
  defaultValue: string
}

export function DashScopePricingSettings({
  defaultValue,
}: DashScopePricingSettingsProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [jsonText, setJsonText] = useState(() => normalizeJsonText(defaultValue))
  const [jsonError, setJsonError] = useState('')
  const [builderData, setBuilderData] = useState<Record<string, PricingModel>>(
    () => normalizePricingConfig(defaultValue)
  )

  useEffect(() => {
    setJsonText(normalizeJsonText(defaultValue))
    setJsonError('')
    setBuilderData(normalizePricingConfig(defaultValue))
  }, [defaultValue])

  const fields = useMemo(
    () => [
      ['resolution', '480p / 720p / 1080p / 2k / 4k'],
      ['raw_resolution', 'original resolution value'],
      ['size', 'original size value, for example 1920*1080'],
      ['duration', 'video seconds'],
      ['image_count', 'generated image count'],
      ['model', 'requested model name'],
      ['action', 'dashscope_image or dashscope_video'],
    ],
    []
  )

  const validateJson = useCallback(
    (text: string) => {
      try {
        const parsed = JSON.parse(text) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setJsonError(t('JSON must be an object'))
          return false
        }
        setJsonError('')
        return true
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : t('Invalid JSON'))
        return false
      }
    },
    [t]
  )

  const handleTextChange = useCallback(
    (value: string) => {
      setJsonText(value)
      validateJson(value)
    },
    [validateJson]
  )

  const handleSave = useCallback(async () => {
    if (!validateJson(jsonText)) {
      toast.error(t('Please fix JSON errors before saving'))
      return
    }
    await updateOption.mutateAsync({
      key: OPTION_KEY,
      value: JSON.stringify(JSON.parse(jsonText)),
    })
  }, [jsonText, t, updateOption, validateJson])

  const syncBuilderToJson = useCallback((next: Record<string, PricingModel>) => {
    const payload = Object.fromEntries(
      Object.entries(next).map(([model, config]) => [model, serializePricingModel(config)])
    )
    const text = formatJson(payload)
    setBuilderData(next)
    setJsonText(text)
    validateJson(text)
  }, [validateJson])

  const handleCopyTemplate = useCallback(async () => {
    const text = formatJson(DEFAULT_TEMPLATE)
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Failed to copy'))
    }
  }, [t])

  const handleUseTemplate = useCallback(() => {
    const text = formatJson(DEFAULT_TEMPLATE)
    setJsonText(text)
    setJsonError('')
  }, [])

  const updateBuilderModel = useCallback(
    (modelName: string, updater: (current: PricingModel) => PricingModel) => {
      const current = builderData[modelName] || {
        unit: 'second',
        rules: [createDefaultRule()],
      }
      const next = {
        ...builderData,
        [modelName]: updater(current),
      }
      syncBuilderToJson(next)
    },
    [builderData, syncBuilderToJson]
  )

  const addModelFromTemplate = useCallback(() => {
    const modelName = `dashscope-model-${Object.keys(builderData).length + 1}`
    syncBuilderToJson({
      ...builderData,
      [modelName]: {
        unit: 'second',
        rules: [createDefaultRule()],
      },
    })
  }, [builderData, syncBuilderToJson])

  return (
    <SettingsSection
      title={t('DashScope Pricing')}
      description={t(
        'Configure native DashScope image and video pricing with JSON expressions.'
      )}
    >
      <div className='space-y-4'>
        <Alert>
          <AlertDescription className='space-y-2 text-sm'>
            <p>
              {t(
                'Each model uses a billing unit and a price expression. The expression returns the USD unit price; the backend multiplies it by image count or seconds automatically.'
              )}
            </p>
            <p>
              {t(
                'Use param("resolution") for normalized tiers: 480p, 720p, 1080p, 2k, 4k.'
              )}
            </p>
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]'>
          <div className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <Button variant='outline' size='sm' onClick={addModelFromTemplate}>
                <Plus className='mr-2 h-4 w-4' />
                {t('Add model')}
              </Button>
            </div>
            {Object.entries(builderData).map(([modelName, config]) => (
              <div key={modelName} className='space-y-3 rounded-md border p-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Input
                    value={modelName}
                    onChange={(event) => {
                      const nextName = event.target.value.trim()
                      if (!nextName) return
                      const next = { ...builderData }
                      const current = next[modelName]
                      delete next[modelName]
                      next[nextName] = current
                      syncBuilderToJson(next)
                    }}
                    className='max-w-xs'
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='outline' size='sm'>
                        {t(config.unit)}
                        <ChevronDown className='ml-2 h-4 w-4' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {UNIT_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() =>
                            updateBuilderModel(modelName, (current) => ({
                              ...current,
                              unit: option.value,
                            }))
                          }
                        >
                          {t(option.label)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      const next = { ...builderData }
                      delete next[modelName]
                      syncBuilderToJson(next)
                    }}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>

                <div className='space-y-2'>
                  {config.rules.map((rule, index) => (
                    <div key={`${modelName}-${index}`} className='grid gap-2 md:grid-cols-4'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='outline' size='sm' className='justify-between'>
                            {rule.field}
                            <ChevronDown className='ml-2 h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {FIELD_OPTIONS.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={() =>
                                updateBuilderModel(modelName, (current) => ({
                                  ...current,
                                  rules: current.rules.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, field: option.value }
                                      : item
                                  ),
                                }))
                              }
                            >
                              {option.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='outline' size='sm' className='justify-between'>
                            {rule.value}
                            <ChevronDown className='ml-2 h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {VALUE_OPTIONS.map((option) => (
                            <DropdownMenuItem
                              key={option}
                              onClick={() =>
                                updateBuilderModel(modelName, (current) => ({
                                  ...current,
                                  rules: current.rules.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, value: option }
                                      : item
                                  ),
                                }))
                              }
                            >
                              {option}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Input
                        value={rule.amount}
                        onChange={(event) =>
                          updateBuilderModel(modelName, (current) => ({
                            ...current,
                            rules: current.rules.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, amount: event.target.value }
                                : item
                            ),
                          }))
                        }
                        placeholder='0.00'
                      />
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          updateBuilderModel(modelName, (current) => ({
                            ...current,
                            rules:
                              current.rules.length > 1
                                ? current.rules.filter((_, itemIndex) => itemIndex !== index)
                                : [createDefaultRule()],
                          }))
                        }
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Textarea
              value={jsonText}
              onChange={(event) => handleTextChange(event.target.value)}
              className='min-h-[440px] font-mono text-sm'
              spellCheck={false}
            />
            {jsonError && (
              <p className='text-destructive text-sm'>{jsonError}</p>
            )}
          </div>

          <div className='space-y-4 rounded-md border p-4'>
            <div className='space-y-2'>
              <h4 className='text-sm font-medium'>{t('Condition fields')}</h4>
              <div className='space-y-2'>
                {fields.map(([field, hint]) => (
                  <div key={field} className='space-y-1'>
                    <Badge variant='secondary'>param("{field}")</Badge>
                    <p className='text-muted-foreground text-xs'>{t(hint)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className='space-y-2'>
              <h4 className='text-sm font-medium'>{t('Example structure')}</h4>
              <pre className='bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs'>
                {formatJson(DEFAULT_TEMPLATE)}
              </pre>
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button variant='outline' size='sm' onClick={handleUseTemplate}>
                <RotateCcw className='mr-2 h-4 w-4' />
                {t('Use template')}
              </Button>
              <Button variant='ghost' size='sm' onClick={handleCopyTemplate}>
                <Copy className='mr-2 h-4 w-4' />
                {t('Copy template')}
              </Button>
            </div>
          </div>
        </div>

        <div className='flex justify-end'>
          <Button
            onClick={handleSave}
            disabled={updateOption.isPending || !!jsonError}
          >
            {updateOption.isPending
              ? t('Saving...')
              : t('Save DashScope pricing')}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
