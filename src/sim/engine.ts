import { z } from 'zod'
import type { View } from './aircraft'

const pair = z.tuple([z.boolean(), z.boolean()])
const n2 = z.number().finite().min(0).max(100)
const flightPlan = z.object({
  fromTo: z.string().regex(/^$|^[A-Z]{4}\/[A-Z]{4}$/),
  flightNo: z.string().max(10), costIndex: z.string().regex(/^$|^\d{1,3}$/),
  cruiseLevel: z.string().regex(/^$|^\d{2,3}$/),
})
export const ecamPages = ['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL', 'APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL', 'STS'] as const
const systemsSchema = z.object({
  engineGenerators: pair.default([true, true]), apuGenerator: z.boolean().default(true),
  packs: pair.default([true, true]), engineBleeds: pair.default([true, true]),
  xbleed: z.enum(['SHUT', 'AUTO', 'OPEN']).default('AUTO'),
  hydraulicPumps: pair.default([true, true]), yellowElectric: z.boolean().default(false), ptu: z.boolean().default(true),
  crewOxygen: z.boolean().default(false), noSmoking: z.enum(['OFF', 'AUTO', 'ON']).default('OFF'),
  emergencyLights: z.enum(['OFF', 'ARM', 'ON']).default('OFF'), cabinFans: z.boolean().default(true),
  antiIce: pair.default([false, false]), wingAntiIce: z.boolean().default(false), probeHeat: z.boolean().default(false),
  dome: z.enum(['OFF', 'DIM', 'BRT']).default('OFF'), integralBrightness: z.number().min(0).max(1).default(.65),
  displayBrightness: z.number().min(.1).max(1).default(1),
  strobe: z.enum(['OFF', 'AUTO', 'ON']).default('OFF'), nose: z.enum(['OFF', 'TAXI', 'T.O']).default('OFF'),
  landing: pair.default([false, false]), turnoff: z.boolean().default(false), wingLight: z.boolean().default(false),
  ecamPage: z.enum(ecamPages).nullable().default(null),
  fireTest: z.number().int().min(-1).max(2).default(-1), fireTestTime: z.number().min(0).default(0),
  fireChecked: z.tuple([z.boolean(), z.boolean(), z.boolean()]).default([false, false, false]),
  lampTest: z.boolean().default(false), fwsReady: z.number().min(0).max(50).default(0),
  apuFlap: z.number().min(0).max(1).default(0), apuCooldown: z.number().min(0).max(60).default(0),
  apuBleedUsed: z.boolean().default(false),
  actualFlaps: z.number().min(0).max(4).default(0),
  fuel: z.tuple([z.number().min(0), z.number().min(0), z.number().min(0)]).default([2600, 1200, 2600]),
  engineEgt: z.tuple([z.number().min(0), z.number().min(0)]).default([18, 18]),
  groundPowerConnected: z.boolean().default(true), chocks: z.boolean().default(true),
  chrono: z.enum(['OFF', 'RUN', 'STOP']).default('OFF'), chronoTime: z.number().min(0).default(0),
})
export type Systems = z.infer<typeof systemsSchema>
export type SystemToggle = 'apuGenerator' | 'yellowElectric' | 'ptu' | 'crewOxygen' | 'cabinFans' | 'wingAntiIce' | 'probeHeat' | 'turnoff' | 'wingLight'
export type SystemPair = 'engineGenerators' | 'packs' | 'engineBleeds' | 'hydraulicPumps' | 'antiIce' | 'landing'
export type SystemSelector = 'xbleed' | 'noSmoking' | 'emergencyLights' | 'dome' | 'strobe' | 'nose'
const systemLabels: Record<SystemToggle | SystemSelector, string> = {
  apuGenerator: 'APU GEN', yellowElectric: 'YELLOW ELEC PUMP', ptu: 'PTU', crewOxygen: 'CREW OXY',
  cabinFans: 'CAB FANS', wingAntiIce: 'WING ANTI ICE', probeHeat: 'PROBE / WINDOW HEAT',
  turnoff: 'RWY TURN OFF', wingLight: 'WING LIGHT', xbleed: 'X BLEED', noSmoking: 'NO SMOKING',
  emergencyLights: 'EMER EXIT LT', dome: 'DOME', strobe: 'STROBE', nose: 'NOSE LIGHT',
}
const pairLabels: Record<SystemPair, [string, string]> = {
  engineGenerators: ['ENG GEN 1', 'ENG GEN 2'], packs: ['PACK 1', 'PACK 2'], engineBleeds: ['ENG 1 BLEED', 'ENG 2 BLEED'],
  hydraulicPumps: ['GREEN ENG PUMP', 'YELLOW ENG PUMP'], antiIce: ['ENG 1 ANTI ICE', 'ENG 2 ANTI ICE'], landing: ['LAND L', 'LAND R'],
}
export const selectorValues = {
  xbleed: ['SHUT', 'AUTO', 'OPEN'], noSmoking: ['OFF', 'AUTO', 'ON'], emergencyLights: ['OFF', 'ARM', 'ON'],
  dome: ['OFF', 'DIM', 'BRT'], strobe: ['OFF', 'AUTO', 'ON'], nose: ['OFF', 'TAXI', 'T.O'],
} as const
export const stateSchema = z.object({
  systems: systemsSchema.prefault({}),
  version: z.literal(1), elapsed: z.number().finite().min(0),
  batteries: pair, externalPower: z.boolean(), apuMaster: z.boolean(),
  apuStarting: z.boolean(), apuRpm: n2, apuBleed: z.boolean(),
  ir: z.tuple([z.boolean(), z.boolean(), z.boolean()]),
  irRemaining: z.tuple([z.number().min(0).max(420), z.number().min(0).max(420), z.number().min(0).max(420)]),
  pumps: z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean(), z.boolean()]),
  beacon: z.boolean(), seatbelts: z.boolean(), navLights: z.boolean(),
  engineMaster: pair, engineN2: z.tuple([n2, n2]), ignition: z.enum(['NORM', 'IGN/START']),
  parkingBrake: z.boolean(), flaps: z.number().int().min(0).max(4), throttle: z.number().min(0).max(100),
  fcu: z.object({ speed: z.number().min(100).max(399), heading: z.number().min(0).max(359), altitude: z.number().min(100).max(39000), ap1: z.boolean(), fd: z.boolean() }),
  flightPlan, milestones: z.array(z.string()).max(30),
  events: z.array(z.object({ time: z.number(), message: z.string(), level: z.enum(['info', 'success', 'warning']) })).max(80),
})
export type SimState = z.infer<typeof stateSchema>
export type SimEvent = SimState['events'][number]
export type Action =
  | { type: 'tick'; dt: number; realDt?: number }
  | { type: 'systemToggle'; key: SystemToggle }
  | { type: 'systemPair'; key: SystemPair; index: 0 | 1 }
  | { type: 'selector'; key: SystemSelector; direction: number }
  | { type: 'brightness'; key: 'integralBrightness' | 'displayBrightness'; delta: number }
  | { type: 'ecam'; page: Systems['ecamPage'] }
  | { type: 'ecamCycle' } | { type: 'chrono' }
  | { type: 'fireTest'; index: 0 | 1 | 2; active: boolean }
  | { type: 'lampTest'; active: boolean }
  | { type: 'groundPower' } | { type: 'chocks' }
  | { type: 'battery'; index: 0 | 1 }
  | { type: 'external' } | { type: 'apuMaster' } | { type: 'apuStart' } | { type: 'apuBleed' }
  | { type: 'ir'; index: 0 | 1 | 2 } | { type: 'pump'; index: 0 | 1 | 2 | 3 | 4 | 5 }
  | { type: 'beacon' } | { type: 'seatbelts' } | { type: 'navLights' }
  | { type: 'engine'; index: 0 | 1 } | { type: 'ignition' } | { type: 'parkingBrake' }
  | { type: 'flaps'; value: number } | { type: 'throttle'; value: number }
  | { type: 'fcu'; field: 'speed' | 'heading' | 'altitude'; delta: number }
  | { type: 'fd' } | { type: 'ap1' }
  | { type: 'plan'; field: keyof SimState['flightPlan']; value: string }
  | { type: 'reset'; ready?: boolean }
  | { type: 'notice'; message: string }

export const ENGINE_GENERATING = (s: SimState, i: number) => s.engineN2[i] >= 58 && s.systems.engineGenerators[i]
export const APU_AVAILABLE = (s: SimState) => s.apuRpm >= 95
export const AC_POWER = (s: SimState) => s.externalPower && s.systems.groundPowerConnected || APU_AVAILABLE(s) && s.systems.apuGenerator || [0, 1].some(i => ENGINE_GENERATING(s, i))
export const DC_POWER = (s: SimState) => s.batteries.some(Boolean) || AC_POWER(s)
export const ALIGNED = (s: SimState) => s.ir.every(Boolean) && s.irRemaining.every(n => n === 0)
export const ENGINES_RUNNING = (s: SimState) => s.engineN2.every(n => n >= 67)
export const POWER_SOURCE = (s: SimState) => [0, 1].some(i => ENGINE_GENERATING(s, i)) ? 'ENG GEN' : s.externalPower && s.systems.groundPowerConnected ? 'EXT PWR' : APU_AVAILABLE(s) && s.systems.apuGenerator ? 'APU GEN' : s.batteries.some(Boolean) ? 'BAT ONLY' : 'NO POWER'
export const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
export const engineN1 = (s: SimState, index: number) => s.engineN2[index] / 68 * (19.5 + (s.engineN2[index] >= 67 ? s.throttle * .65 : 0))
export const fuelFlow = (s: SimState, i: number) => s.engineMaster[i] && fuelAvailable(s, i) && s.engineN2[i] >= 20 ? (s.engineN2[i] >= 67 ? 290 + s.throttle * 37 : 180 + s.engineN2[i] * 1.6) : 0
export const STARTER_OPEN = (s: SimState, i: number) => s.engineMaster[i] && s.ignition === 'IGN/START' && s.engineN2[i] < 55 && s.apuRpm >= 95 && s.apuBleed && s.systems.xbleed !== 'SHUT'
export const BLEED_PRESSURE = (s: SimState) => s.apuBleed && APU_AVAILABLE(s) ? 39 : s.engineN2.some((n, i) => n >= 58 && s.systems.engineBleeds[i]) ? 42 : 0
export const PACK_FLOW = (s: SimState, i: number) => AC_POWER(s) && s.systems.packs[i] && BLEED_PRESSURE(s) > 0 && s.ignition !== 'IGN/START'
export const HYD_PRESSURE = (s: SimState, i: number) => {
  const green = s.engineN2[0] > 45 && s.systems.hydraulicPumps[0]
  const yellow = s.engineN2[1] > 45 && s.systems.hydraulicPumps[1] || s.systems.yellowElectric && AC_POWER(s)
  const transfer = s.systems.ptu && ENGINES_RUNNING(s)
  return i === 0 ? green || transfer && yellow ? 3000 : 0 : i === 2 ? yellow || transfer && green ? 3000 : 0 : AC_POWER(s) && s.engineN2.some(n => n > 45) ? 3000 : 0
}
export const ECAM_PAGE = (s: SimState) => s.ignition === 'IGN/START' ? 'ENG' : s.systems.ecamPage || (s.apuMaster && s.apuRpm < 95 ? 'APU' : s.engineN2.some(n => n >= 58) ? 'WHEEL' : 'DOOR')
export const FIRE_WARNING = (s: SimState) => s.systems.fireTest >= 0 && AC_POWER(s) && s.systems.fwsReady >= 50

export function initialState(ready = false): SimState {
  return {
    systems: systemsSchema.parse({ fwsReady: ready ? 50 : 0 }),
    version: 1, elapsed: 0, batteries: [ready, ready], externalPower: ready,
    apuMaster: false, apuStarting: false, apuRpm: 0, apuBleed: false,
    ir: [ready, ready, ready], irRemaining: ready ? [0, 0, 0] : [420, 420, 420],
    pumps: [false, false, false, false, false, false], beacon: false, seatbelts: false, navLights: false,
    engineMaster: [false, false], engineN2: [0, 0], ignition: 'NORM',
    parkingBrake: true, flaps: 0, throttle: 0,
    fcu: { speed: 250, heading: 0, altitude: 10000, ap1: false, fd: false },
    flightPlan: { fromTo: '', flightNo: '', costIndex: '', cruiseLevel: '' }, milestones: [],
    events: [{ time: 0, message: ready ? '已载入上电场景 · 惯导已对准' : '冷舱场景已载入 · 停机刹车已设置', level: 'info' }],
  }
}

export type Step = { id: string; title: string; label: string; view: View; detail: string; done: (s: SimState) => boolean }
export const steps: Step[] = [
  { id: 'batteries', title: '接通电瓶', label: 'BAT 1 + BAT 2', view: 'overhead', detail: '在 ELEC 面板按下 BAT 1 和 BAT 2，将电瓶设置为 AUTO。只有电瓶时，主显示器保持熄灭。', done: s => s.batteries.every(Boolean) },
  { id: 'power', title: '接通地面电源', label: 'EXT PWR → ON', view: 'overhead', detail: 'EXT PWR 的 AVAIL 表示地面电源可用。按下接通交流母线，主显示器随之点亮。', done: s => s.externalPower },
  { id: 'firetests', title: '测试火警系统', label: 'ENG 1 / APU / ENG 2 · TEST', view: 'overhead', detail: '交流上电 50 秒后，分别按住三个 TEST 按钮至少 3 秒，确认火警灯、ECAM 警告与连续重复谐音。松开恢复正常。', done: s => s.systems.fireChecked.every(Boolean) },
  { id: 'signs', title: '氧气与客舱准备', label: 'OXY / SIGNS / EMER EXIT LT', view: 'overhead', detail: 'CREW OXY 接通；SEAT BELTS ON；NO SMOKING AUTO；EMER EXIT LT ARM。', done: s => s.systems.crewOxygen && s.seatbelts && s.systems.noSmoking !== 'OFF' && s.systems.emergencyLights !== 'OFF' },
  { id: 'nav', title: '打开航行灯', label: 'NAV & LOGO → ON', view: 'overhead', detail: '航行灯接通，外部视角可观察左红右绿与尾部白灯。', done: s => s.navLights },
  { id: 'irs', title: '启动惯导对准', label: 'IR 1 / 2 / 3 → NAV', view: 'overhead', detail: '将三个 IR 旋钮切换到 NAV。对准计时为简化的 7 分钟模拟时间，可同时进行其他准备。', done: s => s.ir.every(Boolean) },
  { id: 'fuel', title: '接通燃油泵', label: 'FUEL PUMPS → ON', view: 'overhead', detail: '接通左右机翼和中央油箱的六个燃油泵。本场景预设有中央油箱燃油。', done: s => s.pumps.every(Boolean) },
  { id: 'apu', title: '启动辅助动力装置', label: 'APU MASTER + START', view: 'overhead', detail: '按下 APU MASTER SW，再按 START。等待转速达到可用状态，START 灯会变为绿色 AVAIL。', done: s => s.apuRpm >= 95 },
  { id: 'bleed', title: '打开 APU 引气', label: 'APU BLEED → ON', view: 'overhead', detail: 'APU 可用后按下 APU BLEED，为发动机启动提供压缩空气。', done: s => s.apuBleed && s.apuRpm >= 95 },
  { id: 'plan', title: '初始化飞行计划', label: 'MCDU · INIT A', view: 'mcdu', detail: '在 MCDU 键盘输入 ZSPD/ZBAA，按右侧第一个行选键。填写航班号、成本指数和巡航高度。示例：AD320 / 30 / 350。', done: s => Object.values(s.flightPlan).every(Boolean) },
  { id: 'beacon', title: '打开防撞灯', label: 'BEACON → ON', view: 'overhead', detail: '发动机启动前打开 BEACON 防撞灯，向地面人员提示飞机即将启动。', done: s => s.beacon },
  { id: 'disconnect', title: '断开地面电源', label: 'EXT PWR → OFF / GPU', view: 'overhead', detail: 'APU 可用后先关闭 EXT PWR，确认 APU GEN 供电。外景的地勤控制可移走电源车。', done: s => s.apuRpm >= 95 && !s.externalPower && AC_POWER(s) },
  { id: 'ignition', title: '设置发动机点火', label: 'ENG MODE → IGN/START', view: 'pedestal', detail: '在中央操纵台将 ENG MODE 旋钮切到 IGN/START。', done: s => s.ignition === 'IGN/START' },
  { id: 'engine1', title: '启动 1 号发动机', label: 'ENG MASTER 1 → ON', view: 'pedestal', detail: '打开 ENG 1 主开关。观察启动活门、N2、EGT、燃油流量与滑油压力，约 1 分钟后稳定至慢车。本练习采用先 1 后 2，航空公司程序可能不同。', done: s => s.engineN2[0] >= 67 },
  { id: 'engine2', title: '启动 2 号发动机', label: 'ENG MASTER 2 → ON', view: 'pedestal', detail: '确认第一台发动机稳定后，打开 ENG 2 主开关。启动期间空调组件自动关闭，稳定后检查双发参数。', done: s => s.engineN2[1] >= 67 },
  { id: 'normal', title: '恢复正常点火模式', label: 'ENG MODE → NORM', view: 'pedestal', detail: '双发稳定后，将 ENG MODE 切回 NORM。', done: s => ENGINES_RUNNING(s) && s.ignition === 'NORM' },
  { id: 'handover', title: '完成电源与引气交接', label: 'APU / EXT PWR → OFF', view: 'overhead', detail: '关闭 APU BLEED，再关闭 APU MASTER。使用过引气后，APU 经过 60 秒冷却才减速。确认双发发电机供电、PACK 恢复。', done: s => ENGINES_RUNNING(s) && !s.apuBleed && !s.apuMaster && !s.externalPower },
  { id: 'aligned', title: '确认惯导对准完成', label: 'ADIRS → ALIGNED', view: 'fcu', detail: '等待三个 IR 全部对准，主飞行显示器显示姿态。冷舱启动练习完成。', done: s => ALIGNED(s) && ENGINES_RUNNING(s) && s.ignition === 'NORM' && !s.apuMaster && !s.externalPower },
]

function append(s: SimState, message: string, level: SimEvent['level'] = 'info') {
  s.events = [{ time: s.elapsed, message, level }, ...s.events].slice(0, 80)
}
function settle(s: SimState) {
  for (const step of steps) if (!s.milestones.includes(step.id) && step.done(s)) s.milestones.push(step.id)
  return s
}
function fuelAvailable(s: SimState, index: number) { return (index === 0 ? s.pumps[0] || s.pumps[1] : s.pumps[4] || s.pumps[5]) && s.systems.fuel[index === 0 ? 0 : 2] > 0 }

export function simReducer(previous: SimState, action: Action): SimState {
  if (action.type === 'reset') return settle(initialState(action.ready))
  const s = structuredClone(previous)
  const reject = (reason: string) => { append(s, reason, 'warning'); return s }
  switch (action.type) {
    case 'tick': {
      const dt = Number.isFinite(action.dt) ? Math.min(Math.max(action.dt, 0), 5) : 0
      const realDt = Math.min(Math.max(action.realDt ?? dt, 0), 5)
      s.elapsed += dt
      const sys = s.systems
      sys.fwsReady = AC_POWER(s) ? Math.min(50, sys.fwsReady + dt) : 0
      sys.apuFlap = Math.max(0, Math.min(1, sys.apuFlap + (s.apuMaster || s.apuRpm > 7 ? 1 : -1) * dt / 3))
      if (!s.apuMaster && sys.apuCooldown > 0) sys.apuCooldown = Math.max(0, sys.apuCooldown - dt)
      const apuSustaining = s.apuRpm >= 95 || s.batteries.every(Boolean)
      if ((s.apuMaster && s.apuStarting || sys.apuCooldown > 0) && apuSustaining && sys.apuFlap >= 1) s.apuRpm = Math.min(100, s.apuRpm + dt * 100 / 60)
      else if (!s.apuMaster || !apuSustaining) { s.apuRpm = Math.max(0, s.apuRpm - dt * 4); if (!s.apuRpm) s.apuStarting = false }
      if (previous.apuRpm < 95 && APU_AVAILABLE(s)) append(s, 'APU AVAIL · 辅助电源和引气可用', 'success')
      if (s.apuBleed && APU_AVAILABLE(s)) sys.apuBleedUsed = true
      s.irRemaining = s.irRemaining.map((remaining, i) => s.ir[i] && AC_POWER(s) ? Math.max(0, remaining - dt) : 420) as SimState['irRemaining']
      if (!ALIGNED(previous) && ALIGNED(s)) append(s, 'ADIRS 对准完成 · 姿态基准可用', 'success')
      s.engineN2 = s.engineN2.map((rpm, i) => {
        const canRun = s.engineMaster[i] && fuelAvailable(s, i)
        const canStart = s.ignition === 'IGN/START' && APU_AVAILABLE(s) && s.apuBleed && AC_POWER(s) && sys.xbleed !== 'SHUT'
        // Approximate the starter spool, light-off, starter cutout, and idle stabilization separately.
        if (canRun && (rpm >= 55 || canStart)) return Math.min(68, rpm + dt * (rpm < 20 ? 1.4 : rpm < 55 ? 1.55 : .52))
        return Math.max(0, rpm - dt * 2.2)
      }) as SimState['engineN2']
      for (const i of [0, 1]) {
        const rpm = s.engineN2[i], ff = fuelFlow(s, i)
        const targetEgt = ff > 0 ? rpm < 55 ? 18 + (rpm - 20) / 35 * 650 : rpm < 67 ? 660 : 520 + s.throttle * 3.1 : 18
        sys.engineEgt[i] += (targetEgt - sys.engineEgt[i]) * (1 - Math.exp(-dt / (ff ? 3 : 35)))
        const tank = i === 0 ? 0 : 2
        if (sys.fuel[1] > 0 && (s.pumps[2] || s.pumps[3])) sys.fuel[1] = Math.max(0, sys.fuel[1] - ff * dt / 3600)
        else sys.fuel[tank] = Math.max(0, sys.fuel[tank] - ff * dt / 3600)
        if (previous.engineN2[i] < 67 && rpm >= 67) append(s, `ENG ${i + 1} · AVAIL，发动机稳定慢车`, 'success')
        if (previous.engineN2[i] >= 55 && rpm < 55) append(s, `ENG ${i + 1} · 发动机正在减速`, 'warning')
      }
      if (s.apuRpm > 10) sys.fuel[0] = Math.max(0, sys.fuel[0] - .025 * dt)
      if (HYD_PRESSURE(s, 0) > 0 || HYD_PRESSURE(s, 2) > 0) sys.actualFlaps += Math.sign(s.flaps - sys.actualFlaps) * Math.min(Math.abs(s.flaps - sys.actualFlaps), dt / 6)
      if (sys.fireTest >= 0 && DC_POWER(s)) {
        sys.fireTestTime += realDt
        if (sys.fireTestTime >= 3 && FIRE_WARNING(s) && !sys.fireChecked[sys.fireTest]) { sys.fireChecked[sys.fireTest] = true; append(s, `${['ENG 1', 'APU', 'ENG 2'][sys.fireTest]} FIRE TEST · 已检查`, 'success') }
      }
      if (sys.chrono === 'RUN' && AC_POWER(s)) sys.chronoTime += dt
      break
    }
    case 'battery': s.batteries[action.index] = !s.batteries[action.index]; append(s, `BAT ${action.index + 1} → ${s.batteries[action.index] ? 'AUTO' : 'OFF'}`); break
    case 'external': if (!s.systems.groundPowerConnected) return reject('地面电源未连接，请在外景地勤面板接入 GPU。'); s.externalPower = !s.externalPower; append(s, `EXT PWR → ${s.externalPower ? 'ON' : 'OFF'}`); break
    case 'apuMaster':
      if (!s.apuMaster && !s.batteries.every(Boolean)) return reject('APU 启动条件未满足：请接通 BAT 1 和 BAT 2。')
      s.apuMaster = !s.apuMaster
      if (!s.apuMaster) { s.systems.apuCooldown = s.systems.apuBleedUsed && APU_AVAILABLE(s) ? 60 : 0; s.apuStarting = false; s.apuBleed = false; if (s.systems.apuCooldown) append(s, 'APU 冷却中 · 60 秒后关闭') } else { s.systems.apuCooldown = 0; s.systems.apuBleedUsed = false }
      append(s, `APU MASTER → ${s.apuMaster ? 'ON' : 'OFF'}`); break
    case 'apuStart':
      if (!s.apuMaster || !s.batteries.every(Boolean)) return reject('请先接通两个电瓶，再打开 APU MASTER SW。')
      if (s.apuStarting) return s
      s.apuStarting = true; append(s, 'APU 启动中 · 约 60 秒模拟时间'); break
    case 'apuBleed':
      if (!s.apuBleed && s.apuRpm < 95) return reject('APU 尚未可用，请等待绿色 AVAIL 指示。')
      s.apuBleed = !s.apuBleed; append(s, `APU BLEED → ${s.apuBleed ? 'ON' : 'OFF'}`); break
    case 'ir': s.ir[action.index] = !s.ir[action.index]; s.irRemaining[action.index] = 420; append(s, `IR ${action.index + 1} → ${s.ir[action.index] ? 'NAV · 开始对准' : 'OFF'}`); break
    case 'pump': s.pumps[action.index] = !s.pumps[action.index]; append(s, `FUEL PUMP ${action.index + 1} → ${s.pumps[action.index] ? 'ON' : 'OFF'}`); break
    case 'beacon': case 'seatbelts': case 'navLights': s[action.type] = !s[action.type]; append(s, `${{ beacon: 'BEACON', seatbelts: 'SEAT BELTS', navLights: 'NAV & LOGO' }[action.type]} → ${s[action.type] ? 'ON' : 'OFF'}`); break
    case 'engine': {
      const i = action.index
      if (!s.engineMaster[i]) {
        if (!AC_POWER(s)) return reject('启动中止：交流母线未通电。')
        if (s.ignition !== 'IGN/START') return reject('启动中止：请将 ENG MODE 设置为 IGN/START。')
        if (s.apuRpm < 95 || !s.apuBleed || s.systems.xbleed === 'SHUT') return reject('启动中止：需要 APU AVAIL 且 APU BLEED 为 ON。')
        if (!fuelAvailable(s, i)) return reject(`启动中止：请接通 ${i === 0 ? '左' : '右'}机翼燃油泵。`)
        const other = 1 - i
        if (s.engineMaster[other] && s.engineN2[other] < 67) return reject('请等待另一台发动机稳定慢车后，再启动此发动机。')
        if (s.throttle !== 0) return reject('启动中止：请先将推力手柄收至 IDLE。')
        if (!s.beacon) append(s, '提醒：启动前请打开 BEACON 防撞灯。', 'warning')
      }
      s.engineMaster[i] = !s.engineMaster[i]; append(s, `ENG MASTER ${i + 1} → ${s.engineMaster[i] ? 'ON · 启动序列开始' : 'OFF'}`); break
    }
    case 'ignition': s.ignition = s.ignition === 'NORM' ? 'IGN/START' : 'NORM'; append(s, `ENG MODE → ${s.ignition}`); break
    case 'parkingBrake': s.parkingBrake = !s.parkingBrake; append(s, `PARK BRK → ${s.parkingBrake ? 'ON' : 'OFF'} · 本版不模拟地面移动`); break
    case 'flaps': s.flaps = Math.max(0, Math.min(4, Math.round(action.value))); break
    case 'throttle': s.throttle = Math.max(0, Math.min(100, action.value)); break
    case 'fcu': {
      if (!AC_POWER(s)) return reject('FCU 未通电：请先接通交流电源。')
      const bounds = { speed: [100, 399], heading: [0, 359], altitude: [100, 39000] }
      const v = s.fcu[action.field] + action.delta
      s.fcu[action.field] = action.field === 'heading' ? (v % 360 + 360) % 360 : Math.max(bounds[action.field][0], Math.min(bounds[action.field][1], v)); break
    }
    case 'fd': if (AC_POWER(s)) s.fcu.fd = !s.fcu.fd; else return reject('飞行指引未通电。'); break
    case 'ap1': return reject('当前为地面操作场景。自动驾驶与空中飞行将在后续版本接入。')
    case 'plan': {
      if (!AC_POWER(s)) return reject('MCDU 未通电。')
      const v = action.value.trim().toUpperCase()
      if (action.field === 'fromTo' && !/^[A-Z]{4}\/[A-Z]{4}$/.test(v)) return reject('FORMAT ERROR · 请使用四字 ICAO 格式，例如 ZSPD/ZBAA。')
      if (action.field === 'flightNo' && !/^[A-Z0-9]{1,10}$/.test(v)) return reject('FORMAT ERROR · 航班号需为 1–10 位字母或数字。')
      if (action.field === 'costIndex' && (!/^\d{1,3}$/.test(v) || +v > 999)) return reject('ENTRY OUT OF RANGE · 成本指数范围 0–999。')
      if (action.field === 'cruiseLevel' && (!/^\d{2,3}$/.test(v) || +v < 50 || +v > 390)) return reject('ENTRY OUT OF RANGE · 本场景巡航高度范围 FL050–390。')
      s.flightPlan[action.field] = v; append(s, `MCDU · ${{fromTo:'FROM/TO',flightNo:'FLT NBR',costIndex:'COST INDEX',cruiseLevel:'CRZ FL'}[action.field]} = ${v}`, 'success'); break
    }
    case 'systemToggle': s.systems[action.key] = !s.systems[action.key]; append(s, `${systemLabels[action.key]} → ${s.systems[action.key] ? 'ON' : 'OFF'}`); break
    case 'systemPair': s.systems[action.key][action.index] = !s.systems[action.key][action.index]; append(s, `${pairLabels[action.key][action.index]} → ${s.systems[action.key][action.index] ? 'ON' : 'OFF'}`); break
    case 'selector': {
      const values = selectorValues[action.key] as readonly string[]
      const next = values[(values.indexOf(s.systems[action.key]) + (action.direction < 0 ? -1 : 1) + values.length) % values.length]
      Object.assign(s.systems, { [action.key]: next }); append(s, `${systemLabels[action.key]} → ${next}`); break
    }
    case 'brightness': s.systems[action.key] = Math.max(action.key === 'displayBrightness' ? .1 : 0, Math.min(1, s.systems[action.key] + action.delta)); break
    case 'ecam': if (AC_POWER(s)) s.systems.ecamPage = s.systems.ecamPage === action.page ? null : action.page; break
    case 'ecamCycle': if (AC_POWER(s)) s.systems.ecamPage = ecamPages[(ecamPages.indexOf(ECAM_PAGE(s)) + 1) % ecamPages.length]; break
    case 'fireTest': s.systems.fireTest = action.active ? action.index : -1; s.systems.fireTestTime = 0; break
    case 'lampTest': s.systems.lampTest = action.active; break
    case 'groundPower':
      if (s.externalPower) return reject('请先在顶板关闭 EXT PWR，再断开地面电源线。')
      s.systems.groundPowerConnected = !s.systems.groundPowerConnected; append(s, `地面电源车 → ${s.systems.groundPowerConnected ? '已连接' : '已撤离'}`); break
    case 'chocks': s.systems.chocks = !s.systems.chocks; append(s, `轮挡 → ${s.systems.chocks ? '放置' : '移除'}`); break
    case 'chrono': s.systems.chrono = s.systems.chrono === 'OFF' ? 'RUN' : s.systems.chrono === 'RUN' ? 'STOP' : 'OFF'; if (s.systems.chrono === 'OFF') s.systems.chronoTime = 0; break
    case 'notice': append(s, action.message); break
  }
  return settle(s)
}

export function restoreState(raw: string | null): SimState | null {
  if (!raw) return null
  try { const result = stateSchema.safeParse(JSON.parse(raw)); if (!result.success) return null; result.data.systems.fireTest = -1; result.data.systems.fireTestTime = 0; result.data.systems.lampTest = false; return result.data } catch { return null }
}
