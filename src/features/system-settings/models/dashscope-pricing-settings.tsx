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
    prices: {
      '480p': 0,
      '720p': 0,
      '1080p': 0,
      '2k': 0,
      '4k': 0,
    },
  },
  'your-dashscope-image-model': {
    unit: 'image',
    prices: {
      '1k': 0,
      '2k': 0,
      '4k': 0,
    },
  },
}

type PricingModel = {
  unit: 'second' | 'image'
  prices: Record<string, string>
  priceExpr?: string
}

const VIDEO_TIER_OPTIONS = ['480p', '720p', '1080p', '2k', '4k']
const IMAGE_TIER_OPTIONS = ['1k', '2k', '4k']

const UNIT_OPTIONS: Array<{ value: PricingModel['unit']; label: string }> = [
  { value: 'second', label: 'second' },
  { value: 'image', label: 'image' },
]

function getTierOptions(unit: PricingModel['unit']) {
  return unit === 'image' ? IMAGE_TIER_OPTIONS : VIDEO_TIER_OPTIONS
}

function createDefaultPrices(unit: PricingModel['unit'] = 'second'): Record<string, string> {
  return Object.fromEntries(getTierOptions(unit).map((key) => [key, '0']))
}

function mergeDefaultPrices(
  unit: PricingModel['unit'],
  prices: Record<string, string> = {}
): Record<string, string> {
  return {
    ...createDefaultPrices(unit),
    ...prices,
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
      let prices = createDefaultPrices(unit)
      if (
        typed.prices &&
        typeof typed.prices === 'object' &&
        !Array.isArray(typed.prices)
      ) {
        Object.entries(typed.prices as Record<string, unknown>).forEach(
          ([key, value]) => {
            prices[key] = String(value ?? '0')
          }
        )
      }
      prices = mergeDefaultPrices(unit, prices)
      normalized[model] = {
        unit,
        prices,
        priceExpr:
          typeof typed.price_expr === 'string' ? typed.price_expr : undefined,
      }
    })
    return normalized
  } catch {
    return {}
  }
}

function serializePricingModel(model: PricingModel) {
  const prices = Object.fromEntries(
    Object.entries(model.prices)
      .map(([key, value]) => [key, Number(value || 0)])
      .filter(([, value]) => Number(value) > 0)
  )
  const payload: Record<string, unknown> = {
    unit: model.unit,
  }
  if (model.priceExpr?.trim()) {
    payload.price_expr = model.priceExpr.trim()
  }
  if (!model.priceExpr?.trim() || Object.keys(prices).length > 0) {
    payload.prices = prices
  }
  return payload
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
      ['quality', 'image quality or tier, for example auto / hd / 2k / 4k'],
      ['aspect_ratio', 'aspect ratio, for example 1:1 / 4:3 / 16:9'],
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
      if (validateJson(value)) {
        setBuilderData(normalizePricingConfig(value))
      }
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
    setBuilderData(normalizePricingConfig(text))
  }, [])

  const updateBuilderModel = useCallback(
    (modelName: string, updater: (current: PricingModel) => PricingModel) => {
      const current = builderData[modelName] || {
        unit: 'second',
        prices: createDefaultPrices(),
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
          prices: createDefaultPrices(),
        },
    })
  }, [builderData, syncBuilderToJson])

  return (
    <SettingsSection
      title={t('DashScope Pricing')}
      description={t(
        'Configure native DashScope image and video pricing by resolution.'
      )}
    >
      <div className='space-y-4'>
        <Alert>
          <AlertDescription className='space-y-2 text-sm'>
            <p>
              {t(
                'Each model uses a billing unit and resolution price table. The backend multiplies image prices by image count and video prices by seconds automatically.'
              )}
            </p>
            <p>
              {t(
                'Leave a tier price at 0 to use the base tier price.'
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
                              prices: mergeDefaultPrices(option.value, current.prices),
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

                <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-3'>
                  {getTierOptions(config.unit).map((resolution) => (
                    <div key={resolution} className='space-y-1'>
                      <div className='flex items-center justify-between gap-2'>
                        <Badge variant='secondary'>{resolution}</Badge>
                        <span className='text-muted-foreground text-xs'>
                          {config.unit === 'second' ? t('USD / second') : t('USD / image')}
                        </span>
                      </div>
                      <Input
                        value={config.prices[resolution] ?? '0'}
                        onChange={(event) =>
                          updateBuilderModel(modelName, (current) => ({
                            ...current,
                            prices: {
                              ...current.prices,
                              [resolution]: event.target.value,
                            },
                          }))
                        }
                        placeholder='0.00'
                      />
                    </div>
                  ))}
                </div>
                <div className='space-y-1'>
                  <div className='flex items-center justify-between gap-2'>
                    <Badge variant='outline'>price_expr</Badge>
                    <span className='text-muted-foreground text-xs'>
                      {t('Optional expression pricing')}
                    </span>
                  </div>
                  <Textarea
                    value={config.priceExpr ?? ''}
                    onChange={(event) =>
                      updateBuilderModel(modelName, (current) => ({
                        ...current,
                        priceExpr: event.target.value,
                      }))
                    }
                    placeholder='param("resolution") == "4k" ? 0.28 : 0.14'
                    className='min-h-16 font-mono text-xs'
                    spellCheck={false}
                  />
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
              <h4 className='text-sm font-medium'>{t('Billing parameters')}</h4>
              <div className='space-y-2'>
                {fields.map(([field, hint]) => (
                  <div key={field} className='space-y-1'>
                    <Badge variant='secondary'>{field}</Badge>
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
