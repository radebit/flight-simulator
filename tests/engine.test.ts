import { describe, expect, it } from 'vitest'
import { AC_POWER, ALIGNED, DC_POWER, PACK_FLOW, HYD_PRESSURE, ECAM_PAGE, FIRE_WARNING, STARTER_OPEN, fuelFlow, ENGINES_RUNNING, POWER_SOURCE, initialState, restoreState, simReducer, steps, type Action, type SimState } from '../src/sim/engine'

function act(s: SimState, ...actions: Action[]) { return actions.reduce(simReducer, s) }
function advance(s: SimState, seconds: number) { for (let n = 0; n < seconds; n++) s = simReducer(s, { type: 'tick', dt: 1 }); return s }
function apuReady() {
  return advance(act(initialState(), { type: 'battery', index: 0 }, { type: 'battery', index: 1 }, { type: 'external' }, { type: 'apuMaster' }, { type: 'apuStart' }), 65)
}
function startReady() {
  let s = apuReady()
  for (const index of [0, 1, 2, 3, 4, 5] as const) s = simReducer(s, { type: 'pump', index })
  return act(s, { type: 'apuBleed' }, { type: 'beacon' }, { type: 'ignition' })
}

describe('Electrical system', () => {
  it('starts cold and dark with parking brake set', () => {
    const s = initialState()
    expect(AC_POWER(s)).toBe(false)
    expect(DC_POWER(s)).toBe(false)
    expect(s.parkingBrake).toBe(true)
    expect(s.engineN2).toEqual([0, 0])
    expect(s.milestones).toEqual([])
  })
  it('batteries supply DC but do not power the main AC instruments', () => {
    const s = act(initialState(), { type: 'battery', index: 0 }, { type: 'battery', index: 1 })
    expect(DC_POWER(s)).toBe(true)
    expect(AC_POWER(s)).toBe(false)
    expect(POWER_SOURCE(s)).toBe('BAT ONLY')
  })
  it('external power takes priority over the available APU', () => {
    const s = apuReady()
    expect(s.apuRpm).toBe(100)
    expect(POWER_SOURCE(s)).toBe('EXT PWR')
    expect(POWER_SOURCE(simReducer(s, { type: 'external' }))).toBe('APU GEN')
  })
  it('permits an APU start on batteries without external power or fuel pumps', () => {
    const s = advance(act(initialState(), { type: 'battery', index: 0 }, { type: 'battery', index: 1 }, { type: 'apuMaster' }, { type: 'apuStart' }), 65)
    expect(POWER_SOURCE(s)).toBe('APU GEN')
  })
})

describe('APU and ADIRS transitions', () => {
  it('rejects starting without the battery/master prerequisites', () => {
    const s = simReducer(initialState(), { type: 'apuStart' })
    expect(s.apuStarting).toBe(false)
    expect(s.events[0].level).toBe('warning')
  })
  it('blocks bleed before availability and turns it off at shutdown', () => {
    expect(simReducer(initialState(), { type: 'apuBleed' }).apuBleed).toBe(false)
    const s = act(apuReady(), { type: 'apuBleed' }, { type: 'apuMaster' })
    expect(s.apuBleed).toBe(false)
    expect(advance(s, 30).apuRpm).toBe(0)
  })
  it('aligns IR independently and resets alignment on loss of AC power', () => {
    let s = act(initialState(), { type: 'external' }, { type: 'ir', index: 0 }, { type: 'ir', index: 1 })
    s = advance(s, 420)
    expect(s.irRemaining).toEqual([0, 0, 420])
    expect(ALIGNED(s)).toBe(false)
    s = advance(simReducer(s, { type: 'ir', index: 2 }), 420)
    expect(ALIGNED(s)).toBe(true)
    s = advance(simReducer(s, { type: 'external' }), 1)
    expect(ALIGNED(s)).toBe(false)
    expect(s.irRemaining).toEqual([420, 420, 420])
  })
})

describe('Engine starting and continuous dependencies', () => {
  it('rejects missing ignition, bleed and fuel', () => {
    const ready = apuReady()
    const noIgnition = simReducer(ready, { type: 'engine', index: 1 })
    expect(noIgnition.engineMaster[1]).toBe(false)
    expect(noIgnition.events[0].message).toContain('IGN/START')
    const noBleed = act(ready, { type: 'ignition' }, { type: 'engine', index: 1 })
    expect(noBleed.events[0].message).toContain('APU BLEED')
    const noFuel = act(ready, { type: 'ignition' }, { type: 'apuBleed' }, { type: 'engine', index: 1 })
    expect(noFuel.events[0].message).toContain('燃油泵')
    expect(noFuel.engineMaster[1]).toBe(false)
  })
  it('does not permit simultaneous starts in the training model', () => {
    const s = act(startReady(), { type: 'engine', index: 1 }, { type: 'engine', index: 0 })
    expect(s.engineMaster).toEqual([false, true])
    expect(s.events[0].message).toContain('稳定慢车')
  })
  it('stops accelerating if bleed is lost during initial spool', () => {
    let s = advance(simReducer(startReady(), { type: 'engine', index: 1 }), 10)
    const before = s.engineN2[1]
    s = advance(simReducer(s, { type: 'apuBleed' }), 3)
    expect(s.engineN2[1]).toBeLessThan(before)
  })
  it('keeps both engines and AC power running after APU/external power handover', () => {
    let s = advance(simReducer(startReady(), { type: 'engine', index: 1 }), 70)
    s = advance(simReducer(s, { type: 'engine', index: 0 }), 70)
    s = act(s, { type: 'ignition' }, { type: 'apuBleed' }, { type: 'apuMaster' }, { type: 'external' })
    s = advance(s, 90)
    expect(ENGINES_RUNNING(s)).toBe(true)
    expect(s.apuRpm).toBe(0)
    expect(POWER_SOURCE(s)).toBe('ENG GEN')
    expect(s.ignition).toBe('NORM')
  })
  it('loses the corresponding engine when its simulated fuel supply is removed', () => {
    let s = advance(simReducer(startReady(), { type: 'engine', index: 1 }), 70)
    s = advance(act(s, { type: 'pump', index: 4 }, { type: 'pump', index: 5 }), 40)
    expect(s.engineN2[1]).toBe(0)
  })
  it('requires idle thrust before a start', () => {
    const s = act(startReady(), { type: 'throttle', value: 50 }, { type: 'engine', index: 1 })
    expect(s.engineMaster[1]).toBe(false)
    expect(s.events[0].message).toContain('IDLE')
  })
})

describe('MCDU, persistence and complete procedure', () => {
  it('rejects edits while unpowered and invalid airport formats', () => {
    expect(simReducer(initialState(), { type: 'plan', field: 'fromTo', value: 'ZSPD/ZBAA' }).flightPlan.fromTo).toBe('')
    const s = simReducer(initialState(true), { type: 'plan', field: 'fromTo', value: '1234/ABCD' })
    expect(s.flightPlan.fromTo).toBe('')
    expect(s.events[0].message).toContain('FORMAT ERROR')
  })
  it('validates CI and cruise limits and normalizes airports', () => {
    const s = initialState(true)
    expect(simReducer(s, { type: 'plan', field: 'costIndex', value: '1000' }).flightPlan.costIndex).toBe('')
    expect(simReducer(s, { type: 'plan', field: 'cruiseLevel', value: '500' }).flightPlan.cruiseLevel).toBe('')
    expect(simReducer(s, { type: 'plan', field: 'fromTo', value: 'zspd/zbaa' }).flightPlan.fromTo).toBe('ZSPD/ZBAA')
  })
  it('wraps headings and clamps selected altitude', () => {
    const s = initialState(true)
    expect(simReducer(s, { type: 'fcu', field: 'heading', delta: -1 }).fcu.heading).toBe(359)
    expect(simReducer(s, { type: 'fcu', field: 'altitude', delta: 100000 }).fcu.altitude).toBe(39000)
  })
  it('loads validated saves and rejects corrupted or incompatible data', () => {
    const s = initialState()
    expect(restoreState(JSON.stringify(s))).toEqual(s)
    expect(restoreState('{')).toBeNull()
    expect(restoreState(JSON.stringify({ ...s, version: 2 }))).toBeNull()
    expect(restoreState(JSON.stringify({ ...s, engineN2: [NaN, 200] }))).toBeNull()
  })
  it('completes every cold-and-dark milestone and resets cleanly without mutating prior state', () => {
    const original = initialState()
    let s = startReady()
    for (const index of [0, 1, 2] as const) {
      s = advance(simReducer(s, { type: 'fireTest', index, active: true }), 3)
      s = simReducer(s, { type: 'fireTest', index, active: false })
    }
    s = act(s, { type: 'systemToggle', key: 'crewOxygen' }, { type: 'seatbelts' }, { type: 'selector', key: 'noSmoking', direction: 1 }, { type: 'selector', key: 'emergencyLights', direction: 1 }, { type: 'navLights' }, { type: 'external' })
    for (const index of [0, 1, 2] as const) s = simReducer(s, { type: 'ir', index })
    for (const [field, value] of Object.entries({ fromTo: 'ZSPD/ZBAA', flightNo: 'AD320', costIndex: '30', cruiseLevel: '350' })) s = simReducer(s, { type: 'plan', field: field as keyof SimState['flightPlan'], value })
    s = advance(simReducer(s, { type: 'engine', index: 1 }), 70)
    s = advance(simReducer(s, { type: 'engine', index: 0 }), 70)
    s = act(s, { type: 'ignition' }, { type: 'apuBleed' }, { type: 'apuMaster' })
    s = advance(s, 340)
    expect(steps.every(step => s.milestones.includes(step.id))).toBe(true)
    expect(s.milestones).toHaveLength(steps.length)
    expect(ENGINES_RUNNING(s) && ALIGNED(s)).toBe(true)
    expect(original).toEqual(initialState())
    expect(simReducer(s, { type: 'reset' })).toEqual(initialState())
  })
})


describe('Coupled aircraft systems', () => {
  it('disconnects generation without stopping the APU, and preserves power from the other source', () => {
    let s = act(apuReady(), { type: 'external' }, { type: 'systemToggle', key: 'apuGenerator' })
    expect(s.apuRpm).toBe(100)
    expect(AC_POWER(s)).toBe(false)
    expect(DC_POWER(s)).toBe(true)
    s = simReducer(s, { type: 'external' })
    expect(AC_POWER(s)).toBe(true)
  })
  it('closes packs for engine start and restores flow in NORM', () => {
    let s = act(apuReady(), { type: 'apuBleed' })
    expect(PACK_FLOW(s,0)).toBe(true)
    s = simReducer(s,{type:'ignition'})
    expect(PACK_FLOW(s,0)).toBe(false)
    expect(ECAM_PAGE(s)).toBe('ENG')
    s = act(s,{type:'ignition'},{type:'systemPair',key:'packs',index:1})
    expect(PACK_FLOW(s,0)).toBe(true)
    expect(PACK_FLOW(s,1)).toBe(false)
  })
  it('runs starter, fuel ignition, and idle in separate phases', () => {
    let s = simReducer(startReady(), { type:'engine', index:0 })
    s = advance(s, 8)
    expect(STARTER_OPEN(s,0)).toBe(true)
    expect(fuelFlow(s,0)).toBe(0)
    s = advance(s,15)
    expect(fuelFlow(s,0)).toBeGreaterThan(0)
    expect(s.systems.engineEgt[0]).toBeGreaterThan(18)
    s = advance(s,45)
    expect(STARTER_OPEN(s,0)).toBe(false)
    expect(s.engineN2[0]).toBe(68)
    s = advance(s,20)
    expect(s.systems.engineEgt[0]).toBeCloseTo(520,0)
    expect(fuelFlow(s,0)).toBe(290)
  })
  it('keeps the APU running for its bleed cooldown, then spools down', () => {
    let s = advance(act(apuReady(),{type:'apuBleed'}),5)
    s = act(s,{type:'apuBleed'},{type:'apuMaster'})
    expect(s.systems.apuCooldown).toBe(60)
    s = advance(s,30)
    expect(s.apuRpm).toBe(100)
    s = advance(s,60)
    expect(s.apuRpm).toBe(0)
  })
  it('requires hydraulic pressure to move the actual flaps', () => {
    let s = advance(simReducer(initialState(true),{type:'flaps',value:2}),20)
    expect(s.flaps).toBe(2)
    expect(s.systems.actualFlaps).toBe(0)
    s = simReducer(s,{type:'systemToggle',key:'yellowElectric'})
    expect(HYD_PRESSURE(s,2)).toBe(3000)
    s = advance(s,6)
    expect(s.systems.actualFlaps).toBeCloseTo(1)
    s = advance(s,6)
    expect(s.systems.actualFlaps).toBeCloseTo(2)
  })
  it('honors a momentary fire test and actual hold time independent of training acceleration', () => {
    let s = act(initialState(true),{type:'fireTest',index:1,active:true})
    expect(FIRE_WARNING(s)).toBe(true)
    for(let i=0;i<10;i++) s=simReducer(s,{type:'tick',dt:2,realDt:.2})
    expect(s.systems.fireChecked[1]).toBe(false)
    for(let i=0;i<6;i++) s=simReducer(s,{type:'tick',dt:2,realDt:.2})
    expect(s.systems.fireChecked[1]).toBe(true)
    s=simReducer(s,{type:'fireTest',index:1,active:false})
    expect(FIRE_WARNING(s)).toBe(false)
  })
  it('waits for FWS initialization before a powered fire warning test', () => {
    let s=act(initialState(),{type:'external'},{type:'fireTest',index:0,active:true})
    expect(FIRE_WARNING(s)).toBe(false)
    s=advance(s,50)
    expect(FIRE_WARNING(s)).toBe(true)
  })
  it('requires unloading GPU power before physically disconnecting the cable', () => {
    let s=simReducer(initialState(true),{type:'groundPower'})
    expect(s.systems.groundPowerConnected).toBe(true)
    expect(s.events[0].level).toBe('warning')
    s=act(s,{type:'external'},{type:'groundPower'},{type:'external'})
    expect(s.systems.groundPowerConnected).toBe(false)
    expect(s.externalPower).toBe(false)
  })
  it('keeps manual ECAM selection but gives the start sequence display priority', () => {
    let s=act(initialState(true),{type:'ecam',page:'HYD'})
    expect(ECAM_PAGE(s)).toBe('HYD')
    s=simReducer(s,{type:'ignition'})
    expect(ECAM_PAGE(s)).toBe('ENG')
    s=simReducer(s,{type:'ignition'})
    expect(ECAM_PAGE(s)).toBe('HYD')
  })
  it('migrates older saves and never restores a held test button', () => {
    const s=initialState(true)
    const { systems: _systems, ...oldSave }=s
    expect(restoreState(JSON.stringify(oldSave))?.systems.packs).toEqual([true,true])
    const held=act(s,{type:'fireTest',index:0,active:true},{type:'lampTest',active:true})
    expect(restoreState(JSON.stringify(held))?.systems.fireTest).toBe(-1)
    expect(restoreState(JSON.stringify(held))?.systems.lampTest).toBe(false)
  })
})
