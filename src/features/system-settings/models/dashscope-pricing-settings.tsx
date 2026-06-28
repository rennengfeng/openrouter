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
import { Copy, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

  useEffect(() => {
    setJsonText(normalizeJsonText(defaultValue))
    setJsonError('')
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
