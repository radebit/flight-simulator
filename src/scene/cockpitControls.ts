import { AC_POWER, ECAM_PAGE, selectorValues, type Action, type SimState } from '../sim/engine'
import layout from '../sim/model-layout.json'

export const controls: Record<string, { label: string; panel: 'overhead' | 'main' | 'pedestal'; action: Action; step?: string; momentary?: boolean }> = {
  BatteryBtn1: { label: 'BAT 1', panel: 'overhead', action: { type: 'battery', index: 0 }, step: 'batteries' },
  BatteryBtn2: { label: 'BAT 2', panel: 'overhead', action: { type: 'battery', index: 1 }, step: 'batteries' },
  ExtPwrBtn: { label: 'EXT PWR', panel: 'overhead', action: { type: 'external' }, step: 'power' },
  IR1ModeKnb: { label: 'IR 1', panel: 'overhead', action: { type: 'ir', index: 0 }, step: 'irs' },
  IR2ModeKnb: { label: 'IR 2', panel: 'overhead', action: { type: 'ir', index: 1 }, step: 'irs' },
  IR3ModeKnb: { label: 'IR 3', panel: 'overhead', action: { type: 'ir', index: 2 }, step: 'irs' },
  ...Object.fromEntries(['LFuelTank1Btn', 'LFuelTank2Btn', 'CFuelTank1Btn', 'CFuelTank2Btn', 'RFuelTank1Btn', 'RFuelTank2Btn'].map((name, i) => [name, { label: ['L TK PUMP 1', 'L TK PUMP 2', 'CTR TK PUMP 1', 'CTR TK PUMP 2', 'R TK PUMP 1', 'R TK PUMP 2'][i], panel: 'overhead', action: { type: 'pump', index: i }, step: 'fuel' }])),
  APUMasterBtn: { label: 'APU MASTER SW', panel: 'overhead', action: { type: 'apuMaster' }, step: 'apu' },
  APUStartBtn: { label: 'APU START', panel: 'overhead', action: { type: 'apuStart' }, step: 'apu' },
  APUBleedBtn: { label: 'APU BLEED', panel: 'overhead', action: { type: 'apuBleed' }, step: 'bleed' },
  BeaconLtSwtch: { label: 'BEACON', panel: 'overhead', action: { type: 'beacon' }, step: 'beacon' },
  NavLogoLtSwtch: { label: 'NAV & LOGO', panel: 'overhead', action: { type: 'navLights' } },
  SeatBeltSwtch: { label: 'SEAT BELTS', panel: 'overhead', action: { type: 'seatbelts' } },
  Lcutoff: { label: 'ENG MASTER 1', panel: 'pedestal', action: { type: 'engine', index: 0 }, step: 'engine1' },
  Rcutoff: { label: 'ENG MASTER 2', panel: 'pedestal', action: { type: 'engine', index: 1 }, step: 'engine2' },
  eng_mode: { label: 'ENG MODE', panel: 'pedestal', action: { type: 'ignition' }, step: 'ignition' },
  ParkBrk: { label: 'PARK BRK', panel: 'pedestal', action: { type: 'parkingBrake' } },
  ...Object.fromEntries([
    ['Gen1Btn', 'ENG GEN 1', 'engineGenerators', 0], ['Gen2Btn', 'ENG GEN 2', 'engineGenerators', 1],
    ['ACPack1Btn', 'PACK 1', 'packs', 0], ['ACPack2Btn', 'PACK 2', 'packs', 1],
    ['Eng1BleedBtn', 'ENG 1 BLEED', 'engineBleeds', 0], ['Eng2BleedBtn', 'ENG 2 BLEED', 'engineBleeds', 1],
    ['GreenEngPump2', 'GREEN ENG PUMP', 'hydraulicPumps', 0], ['YellowEngPump', 'YELLOW ENG PUMP', 'hydraulicPumps', 1],
    ['Eng1AntiIceBtn', 'ENG 1 ANTI ICE', 'antiIce', 0], ['Eng2AntiIceBtn', 'ENG 2 ANTI ICE', 'antiIce', 1],
    ['LandingLtSwtch', 'LAND L', 'landing', 0], ['LandingLtRSwtch', 'LAND R', 'landing', 1],
  ].map(([name, label, key, index]) => [name, { label, panel: 'overhead', action: { type: 'systemPair', key, index } }])),
  ...Object.fromEntries([
    ['APUGenBtn', 'APU GEN', 'apuGenerator'], ['YellowElecPump', 'YELLOW ELEC PUMP', 'yellowElectric'], ['PTU2', 'HYD PTU', 'ptu'],
    ['CrewOxyBtn', 'CREW OXY', 'crewOxygen'], ['CabinFansBtn', 'CAB FANS', 'cabinFans'], ['WingAntiIceBtn', 'WING ANTI ICE', 'wingAntiIce'],
    ['PrbWinHeatBtn', 'PROBE / WINDOW HEAT', 'probeHeat'], ['TurnoffLtSwtch', 'RWY TURN OFF', 'turnoff'], ['WingLtSwtch', 'WING LIGHT', 'wingLight'],
  ].map(([name, label, key]) => [name, { label, panel: 'overhead', action: { type: 'systemToggle', key }, step: key === 'crewOxygen' ? 'signs' : undefined }])),
  ...Object.fromEntries([
    ['XbleedKnb', 'X BLEED', 'xbleed'], ['NoSmokingSwtch', 'NO SMOKING', 'noSmoking'], ['EmerExtLtSwtch', 'EMER EXIT LT', 'emergencyLights'],
    ['DomeLtSwtch', 'DOME', 'dome'], ['StrobeLtSwtch', 'STROBE', 'strobe'], ['NoseLtSwtch', 'NOSE LIGHT', 'nose'],
  ].map(([name, label, key]) => [name, { label, panel: 'overhead', action: { type: 'selector', key, direction: 1 }, step: ['noSmoking', 'emergencyLights'].includes(key) ? 'signs' : undefined }])),
  ...Object.fromEntries(['Eng1FireTst', 'APUFireTst', 'Eng2FireTst'].map((name, index) => [name, { label: `${['ENG 1', 'APU', 'ENG 2'][index]} FIRE TEST`, panel: 'overhead', action: { type: 'fireTest', index, active: true }, step: 'firetests', momentary: true }])),
  AnnunciatorLtSwtch: { label: 'ANN LT TEST', panel: 'overhead', action: { type: 'lampTest', active: true }, momentary: true },
  ...Object.fromEntries(['eng', 'bleed', 'press', 'elec', 'hyd', 'fuel', 'apu', 'cond', 'door', 'wheel', 'fctl', 'sts'].map(page => [`ecam_${page}`, { label: `ECAM ${page === 'fctl' ? 'F/CTL' : page.toUpperCase()}`, panel: 'pedestal', action: { type: 'ecam', page: page === 'fctl' ? 'F/CTL' : page.toUpperCase() } }])),
  ecam_all: { label: 'ECAM ALL', panel: 'pedestal', action: { type: 'ecamCycle' } },
  ecam_clr_l: { label: 'ECAM CLR L', panel: 'pedestal', action: { type: 'ecam', page: null } },
  ecam_clr_r: { label: 'ECAM CLR R', panel: 'pedestal', action: { type: 'ecam', page: null } },
  chrono_btn: { label: 'CHRONO', panel: 'main', action: { type: 'chrono' } },
  integ_lt: { label: 'INTEGRAL LIGHT', panel: 'pedestal', action: { type: 'brightness', key: 'integralBrightness', delta: .1 } },
  pfd_brt_cpt: { label: 'PFD BRIGHTNESS', panel: 'main', action: { type: 'brightness', key: 'displayBrightness', delta: .1 } },
  ecam_brt_lower: { label: 'ECAM LOWER BRIGHTNESS', panel: 'pedestal', action: { type: 'brightness', key: 'displayBrightness', delta: .1 } },
  ecam_brt_upper: { label: 'ECAM UPPER BRIGHTNESS', panel: 'pedestal', action: { type: 'brightness', key: 'displayBrightness', delta: .1 } },
  'spd-sel': { label: 'FCU 速度', panel: 'main', action: { type: 'fcu', field: 'speed', delta: 1 } },
  hdg_sel: { label: 'FCU 航向', panel: 'main', action: { type: 'fcu', field: 'heading', delta: 1 } },
  'alt-sel': { label: 'FCU 高度', panel: 'main', action: { type: 'fcu', field: 'altitude', delta: 1000 } },
  fd1: { label: 'FD 1', panel: 'main', action: { type: 'fd' } },
  fd2: { label: 'FD 2', panel: 'main', action: { type: 'fd' } },
  ap1: { label: 'AP1', panel: 'main', action: { type: 'ap1' } },
  thr_l_body: { label: '双发推力手柄', panel: 'pedestal', action: { type: 'throttle', value: 0 } },
  FlapsLever: { label: '襟翼手柄', panel: 'pedestal', action: { type: 'flaps', value: 0 } },
}
export const controlLayout = layout.parts as unknown as Record<string, { center: [number, number, number]; size: [number, number, number] }>
export const axes = layout.axes as unknown as Record<string, { pivot: [number, number, number]; direction: [number, number, number] }>
export function controlValue(name: string, s: SimState): string {
  const a = controls[name]?.action
  if (!a) return ''
  switch (a.type) {
    case 'battery': return s.batteries[a.index] ? 'AUTO' : 'OFF'
    case 'external': return s.externalPower ? 'ON' : s.systems.groundPowerConnected ? 'AVAIL' : 'DISCONNECTED'
    case 'ir': return s.ir[a.index] ? (s.irRemaining[a.index] ? 'NAV · ALIGN' : 'NAV · ALIGNED') : 'OFF'
    case 'pump': return s.pumps[a.index] ? 'ON' : 'OFF'
    case 'apuMaster': return s.apuMaster ? 'ON' : 'OFF'
    case 'apuStart': return s.apuRpm >= 95 ? 'AVAIL' : s.apuStarting ? `START ${s.apuRpm.toFixed(0)}%` : 'OFF'
    case 'apuBleed': return s.apuBleed ? 'ON' : 'OFF'
    case 'beacon': return s.beacon ? 'ON' : 'OFF'
    case 'navLights': return s.navLights ? 'ON' : 'OFF'
    case 'seatbelts': return s.seatbelts ? 'ON' : 'OFF'
    case 'engine': return s.engineMaster[a.index] ? `ON · N2 ${s.engineN2[a.index].toFixed(1)}%` : 'OFF'
    case 'ignition': return s.ignition
    case 'parkingBrake': return s.parkingBrake ? 'ON' : 'OFF'
    case 'fd': return s.fcu.fd ? 'ON' : 'OFF'
    case 'ap1': return '地面流程中不可用'
    case 'fcu': return AC_POWER(s) ? String(s.fcu[a.field]) : 'NO AC POWER'
    case 'throttle': return s.throttle ? `${s.throttle}%` : 'IDLE'
    case 'flaps': return ['0', '1', '2', '3', 'FULL'][s.flaps]
    case 'systemPair': return s.systems[a.key][a.index] ? 'ON / AUTO' : 'OFF'
    case 'systemToggle': return s.systems[a.key] ? 'ON / AUTO' : 'OFF'
    case 'selector': return s.systems[a.key]
    case 'brightness': return `${Math.round(s.systems[a.key] * 100)}%`
    case 'ecam': return ECAM_PAGE(s) === a.page ? 'SELECTED' : a.page || 'AUTO'
    case 'fireTest': return s.systems.fireTest === a.index ? 'TEST · 松开停止' : '按住 3 秒测试'
    case 'lampTest': return s.systems.lampTest ? 'TEST' : '按住测试'
    case 'chrono': return s.systems.chrono
    default: return ''
  }
}
export function controlAction(name: string, s: SimState, direction = 1): Action | null {
  const action = controls[name]?.action
  if (!action) return null
  if (action.type === 'selector') return { ...action, direction }
  if (action.type === 'brightness') return { ...action, delta: action.delta * direction }
  if (action.type === 'fcu') return { ...action, delta: action.delta * direction }
  if (action.type === 'throttle') return { ...action, value: Math.max(0, Math.min(100, s.throttle + 5 * direction)) }
  if (action.type === 'flaps') return { ...action, value: Math.max(0, Math.min(4, s.flaps + direction)) }
  return action
}
export function isAdjustable(name: string) { return ['fcu', 'throttle', 'flaps', 'selector', 'brightness'].includes(controls[name]?.action.type) }

/** Original animation axes are taken from the FlightGear source, in converted model coordinates. */
export function controlRotations(s: SimState): Record<string, number> {
  const values: Record<string, number> = {
    IR1ModeKnb: s.ir[0] ? 0 : -35, IR2ModeKnb: s.ir[1] ? 0 : -35, IR3ModeKnb: s.ir[2] ? 0 : -35,
    Lcutoff: s.engineMaster[0] ? -55 : 0, Rcutoff: s.engineMaster[1] ? 55 : 0,
    eng_mode: s.ignition === 'IGN/START' ? 53 : 0, ParkBrk: s.parkingBrake ? 90 : 0,
    BeaconLtSwtch: s.beacon ? 30 : -30, NavLogoLtSwtch: s.navLights ? 30 : -30, SeatBeltSwtch: s.seatbelts ? 30 : -30,
    LandingLtSwtch: s.systems.landing[0] ? 30 : -30, LandingLtRSwtch: s.systems.landing[1] ? 30 : -30,
    WingLtSwtch: s.systems.wingLight ? 30 : -30, TurnoffLtSwtch: s.systems.turnoff ? 30 : -30,
    AnnunciatorLtSwtch: s.systems.lampTest ? 30 : 0,
    'spd-sel': s.fcu.speed * 4, hdg_sel: s.fcu.heading * 4, 'alt-sel': s.fcu.altitude / 1000 * 12,
    FlapsLever: -s.flaps * 8, FlapsLever_low: -s.flaps * 8,
    ...Object.fromEntries(['thr_l_body', 'thr_r_body', 'thr_l_button', 'thr_r_button', 'rev_l', 'rev_r'].map(name => [name, s.throttle * .45])),
  }
  for (const [name, control] of Object.entries(controls)) {
    const a = control.action
    if (a.type === 'selector') values[name] = (selectorValues[a.key] as readonly string[]).indexOf(s.systems[a.key]) * (a.key === 'xbleed' ? 45 : 30) - (a.key === 'xbleed' ? 45 : 30)
    if (a.type === 'brightness') values[name] = s.systems[a.key] * 270
  }
  return values
}
