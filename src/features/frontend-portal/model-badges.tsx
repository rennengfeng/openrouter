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
import { BADGE_TEXT_CLASS, type ModelBadge } from './model-tags'

type ModelBadgesProps = {
  badges: ModelBadge[]
  /** 角标条定位类名，默认贴卡片右上角 */
  className?: string
  /** 右上 + 左下圆角，需与卡片圆角一致（广场 rounded-tr-xl rounded-bl-xl / 首页 rounded-tr-2xl rounded-bl-2xl） */
  cornerClass?: string
}

/**
 * 模型右上角的角标条：左右直边、右上+左下圆角嵌进卡片角；多个角标合并为一条，浅底彩字。
 */
export function ModelBadges({
  badges,
  className = 'absolute right-0 top-0 z-10',
  cornerClass = 'rounded-tr-xl rounded-bl-xl',
}: ModelBadgesProps) {
  const { t } = useTranslation()
  if (!badges.length) return null

  return (
    <div
      className={`${className} flex items-center gap-1.5 overflow-hidden ${cornerClass} bg-gray-50/95 px-2 py-1 shadow-sm ring-1 ring-black/5`}
    >
      {badges.map((b) => (
        <span
          key={b.key}
          className={`inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold leading-none ${BADGE_TEXT_CLASS[b.variant]}`}
        >
          {b.icon && <span className="leading-none">{b.icon}</span>}
          {b.i18nKey ? t(b.i18nKey) : b.label}
        </span>
      ))}
    </div>
  )
}
