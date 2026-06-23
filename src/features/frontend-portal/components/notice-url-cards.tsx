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
import { CopyButton } from '@/components/copy-button'

interface UrlCard {
  url: string
  labelKey: string
  badgeKey: string
  descKey: string
  color: string
  bgColor: string
  badgeBg: string
  badgeColor: string
}

const URL_CARDS: UrlCard[] = [
  {
    url: 'https://api.xendalink.com/v1',
    labelKey: 'portal.notice.url.primary.label',
    badgeKey: 'portal.notice.url.primary.badge',
    descKey: 'portal.notice.url.primary.desc',
    color: '#1d4ed8',
    bgColor: '#f4f8ff',
    badgeBg: '#dbeafe',
    badgeColor: '#1e40af',
  },
  {
    url: 'https://fast.xendalink.com/v1',
    labelKey: 'portal.notice.url.proxy.label',
    badgeKey: 'portal.notice.url.proxy.badge',
    descKey: 'portal.notice.url.proxy.desc',
    color: '#6b21a8',
    bgColor: '#faf5ff',
    badgeBg: '#f3e8ff',
    badgeColor: '#6b21a8',
  },
]

function UrlCardItem({ card }: { card: UrlCard }) {
  const { t } = useTranslation()

  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: card.color + '40', backgroundColor: card.bgColor }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-bold" style={{ color: card.color }}>
          {t(card.labelKey)}
        </span>
        <span
          className="rounded-lg px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: card.badgeBg, color: card.badgeColor }}
        >
          {t(card.badgeKey)}
        </span>
      </div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <code className="flex-1 text-xs font-bold text-gray-800">{card.url}</code>
        <CopyButton
          value={card.url}
          size="sm"
          className="h-7 w-7"
          iconClassName="h-3.5 w-3.5"
        />
      </div>
      <div className="text-xs text-gray-600">{t(card.descKey)}</div>
    </div>
  )
}

export function NoticeUrlCards() {
  return (
    <div className="my-4 grid grid-cols-2 gap-3">
      {URL_CARDS.map((card) => (
        <UrlCardItem key={card.url} card={card} />
      ))}
    </div>
  )
}
