import { createContext, useContext } from 'react'
import { DARK_PALETTE, type ThemePalette } from './themeColors'

export const PaletteContext = createContext<{ palette: ThemePalette; theme: string }>({
  palette: DARK_PALETTE,
  theme: 'dark'
})

export const usePalette = () => useContext(PaletteContext)
