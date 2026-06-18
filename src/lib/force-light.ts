/*
Copyright (C) 2023-2026 QuantumNous

Forces a light color scheme on a subtree even when the global theme is dark.

The app's global theme is `system` (theme-provider adds `html.dark` when the OS
prefers dark). The二开 portal experience is light-only, and its pages force
light locally — but Radix dialogs/drawers render in a portal at <body>, i.e.
under `html.dark`, so they inherit the dark CSS variables. There is no `.light`
class to re-assert light (light lives on `:root`), so we re-declare the light
token values inline on the dialog/drawer content to pin it light.

Values mirror the `:root` block in styles/theme.css.
*/
import type { CSSProperties } from 'react'

export const LIGHT_THEME_STYLE: CSSProperties = {
  colorScheme: 'light',
  '--background': 'oklch(1 0 0)',
  '--foreground': 'oklch(0.145 0 0)',
  '--card': 'oklch(1 0 0)',
  '--card-foreground': 'oklch(0.145 0 0)',
  '--popover': 'oklch(1 0 0)',
  '--popover-foreground': 'oklch(0.145 0 0)',
  '--primary': 'oklch(0.13 0 0)',
  '--primary-foreground': 'oklch(0.985 0 0)',
  '--secondary': 'oklch(0.95 0 0)',
  '--secondary-foreground': 'oklch(0.145 0 0)',
  '--muted': 'oklch(0.97 0 0)',
  '--muted-foreground': 'oklch(0.49 0 0)',
  '--accent': 'oklch(0.95 0 0)',
  '--accent-foreground': 'oklch(0.145 0 0)',
  '--destructive': 'oklch(0.577 0.245 27.325)',
  '--destructive-foreground': 'oklch(0.985 0 0)',
  '--border': 'oklch(0.93 0 0)',
  '--input': 'oklch(0.93 0 0)',
  '--ring': 'oklch(0.708 0 0)',
} as CSSProperties
