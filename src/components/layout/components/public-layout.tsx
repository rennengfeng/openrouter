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
import type { TopNavLink } from '../types'
import { PublicHeader, type PublicHeaderProps } from './public-header'

type PublicLayoutProps = {
  children: React.ReactNode
  showMainContainer?: boolean
  navContent?: React.ReactNode
  headerProps?: Omit<PublicHeaderProps, 'navContent'>
  navLinks?: TopNavLink[]
  showThemeSwitch?: boolean
  showAuthButtons?: boolean
  showNotifications?: boolean
  logo?: React.ReactNode
  siteName?: string
  /**
   * 自定义顶栏:传入后用它替换默认 PublicHeader(in-flow，不固定)，主内容也不再
   * 预留固定头部的 pt-20。用于让公开文档页(关于/隐私/条款)复用门户风格顶栏。
   */
  header?: React.ReactNode
}

export function PublicLayout(props: PublicLayoutProps) {
  if (props.header) {
    return (
      <div className='bg-background text-foreground relative flex min-h-svh flex-col overflow-x-clip'>
        {props.header}
        {props.showMainContainer !== false ? (
          <main className='container px-4 py-6 md:px-4'>{props.children}</main>
        ) : (
          props.children
        )}
      </div>
    )
  }

  return (
    <div className='bg-background text-foreground relative min-h-svh overflow-x-clip'>
      <PublicHeader
        navContent={props.navContent}
        navLinks={props.navLinks}
        showThemeSwitch={props.showThemeSwitch}
        showAuthButtons={props.showAuthButtons}
        showNotifications={props.showNotifications}
        logo={props.logo}
        siteName={props.siteName}
        {...props.headerProps}
      />

      {props.showMainContainer !== false ? (
        <main className='container px-4 py-6 pt-20 md:px-4'>
          {props.children}
        </main>
      ) : (
        props.children
      )}
    </div>
  )
}
