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
import { type ModelBadge } from './model-tags'

type ModelBadgesProps = {
  badges: ModelBadge[]
  /** 角标条定位类名，默认贴卡片右上角 */
  className?: string
  /** 右上圆角，需与卡片圆角一致（广场 rounded-tr-xl / 首页 rounded-tr-2xl）；左下不倒角 */
  cornerClass?: string
}

/**
 * 模型右上角的角标条：左右直边、仅右上圆角嵌进卡片角（左下不倒角）；
 * 多个角标合并为一条统一红底、白字白图标、白色细线分隔。
 */
export function ModelBadges({
  badges,
  className = 'absolute right-0 top-0 z-10',
  cornerClass = 'rounded-tr-xl',
}: ModelBadgesProps) {
  const { t } = useTranslation()
  if (!badges.length) return null

  return (
    <div
      className={`${className} flex items-stretch overflow-hidden ${cornerClass} bg-red-500 text-white shadow-sm ring-1 ring-black/5`}
    >
      {badges.map((b, i) => (
        <span
          key={b.key}
          className={`inline-flex items-center gap-0.5 whitespace-nowrap px-2 py-1 text-xs font-semibold ${i > 0 ? 'border-l border-white/25' : ''}`}
        >
          {b.icon && <span className="leading-none">{b.icon}</span>}
          {b.i18nKey ? t(b.i18nKey) : b.label}
        </span>
      ))}
    </div>
  )
}
