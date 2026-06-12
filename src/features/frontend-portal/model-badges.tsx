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
import { useTranslation } from 'react-i18next'
import { BADGE_VARIANT_CLASS, type ModelBadge } from './model-tags'

type ModelBadgesProps = {
  badges: ModelBadge[]
  /** 角标容器类名，默认绝对定位在卡片右上角 */
  className?: string
}

/** 渲染模型右上角的彩色角标组（new / 火 / 极速 / 限时9折 ...），可叠加多个。 */
export function ModelBadges({ badges, className }: ModelBadgesProps) {
  const { t } = useTranslation()
  if (!badges.length) return null

  return (
    <div className={className ?? 'absolute right-5 top-5 z-10 flex justify-end gap-1'}>
      {badges.map((b) => (
        <span
          key={b.key}
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm ring-1 ring-black/5 ${BADGE_VARIANT_CLASS[b.variant]}`}
        >
          {b.icon && <span className="leading-none">{b.icon}</span>}
          {b.i18nKey ? t(b.i18nKey) : b.label}
        </span>
      ))}
    </div>
  )
}
