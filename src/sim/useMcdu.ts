import { useState } from 'react'
import { AC_POWER, simReducer, type Action, type SimState } from './engine'

export const MCDU_FUNCTIONS = ['dir', 'prog', 'perf', 'init', 'data', 'f-pln', 'radnav', 'fuel-pred', 'f-pln2', 'atc_comm', 'mcdu', 'airport', 'left', 'right', 'up', 'down', 'BRT', 'DIM', 'overfly', 'sp', 'clr', '+/-', '.', '/']
export function mcduKey(name: string) {
  // The source's decimal keys are named `.cpt` / `.fo`, without a second dot.
  return name === '.cpt' || name === '.fo' ? '.' : name.replace(/\.(cpt|fo)$/, '')
}
export function isMcduKey(name: unknown): boolean {
  if (typeof name !== 'string') return false
  const key = mcduKey(name)
  return /\.(cpt|fo)$/.test(name) && (/^[a-z0-9]$/.test(key) || /^[LR][1-6]$/.test(key) || MCDU_FUNCTIONS.includes(key))
}
export function mcduKeyLabel(name: string) {
  const key = mcduKey(name)
  if (/^[LR][1-6]$/.test(key)) return `MCDU LSK${key[1]}${key[0]}`
  return `MCDU ${{ radnav: 'RAD NAV', 'fuel-pred': 'FUEL PRED', 'f-pln2': 'SEC F-PLN', atc_comm: 'ATC COMM', mcdu: 'MENU', overfly: 'OVFY', sp: 'SP' }[key] || key.toUpperCase()}`
}
export type McduScreenState = { page: string; scratch: string; error: string; brightness: number }
export function useMcdu(s: SimState, dispatch: (action: Action) => void) {
  const [screen, setScreen] = useState<McduScreenState>({ page: 'INIT', scratch: '', error: '', brightness: 1 })
  function press(key: string) {
    if (!AC_POWER(s)) { dispatch({ type: 'notice', message: 'MCDU 需要交流电源。请先接通 EXT PWR 或 APU 电源。' }); return }
    if (/^[LR][1-6]$/.test(key)) {
      const field = ({ R1: 'fromTo', L3: 'flightNo', L5: 'costIndex', L6: 'cruiseLevel' } as const)[key as 'R1' | 'L3' | 'L5' | 'L6']
      if (screen.page === 'INIT' && field) {
        if (!screen.scratch) { setScreen(v => ({ ...v, scratch: s.flightPlan[field], error: '' })); return }
        const action: Action = { type: 'plan', field, value: screen.scratch }
        const next = simReducer(s, action)
        if (next.flightPlan[field] === screen.scratch.toUpperCase()) setScreen(v => ({ ...v, scratch: '', error: '' }))
        else setScreen(v => ({ ...v, error: 'FORMAT ERROR' }))
        dispatch(action)
      } else setScreen(v => ({ ...v, error: 'NOT AVAILABLE' }))
      return
    }
    if (['init', 'f-pln', 'data', 'perf', 'dir', 'prog', 'radnav', 'fuel-pred', 'f-pln2', 'atc_comm', 'mcdu', 'airport'].includes(key)) { setScreen(v => ({ ...v, page: key.toUpperCase(), error: '' })); return }
    setScreen(v => {
      if (key === 'clr') return { ...v, error: '', scratch: v.error ? v.scratch : v.scratch.slice(0, -1) }
      if (key === 'delete') return { ...v, error: '', scratch: '' }
      if (key === 'BRT' || key === 'DIM') return { ...v, brightness: Math.max(.3, Math.min(1, v.brightness + (key === 'BRT' ? .1 : -.1))) }
      if (key === '+/-') return { ...v, scratch: v.scratch.startsWith('-') ? v.scratch.slice(1) : `-${v.scratch}`, error: '' }
      if (/^[a-z0-9/.]$/i.test(key) || key === 'sp') return { ...v, scratch: (v.scratch + (key === 'sp' ? ' ' : key.toUpperCase())).slice(0, 24), error: '' }
      return { ...v, error: 'NOT AVAILABLE' }
    })
  }
  return { screen, press }
}
