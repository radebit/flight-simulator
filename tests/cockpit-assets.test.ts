import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hideStaticCockpitPart } from '../src/scene/cockpitVisibility'
import { isMcduKey, mcduKey, mcduKeyLabel } from '../src/sim/useMcdu'
import { controls, controlRotations } from '../src/scene/cockpitControls'
import { initialState, simReducer } from '../src/sim/engine'
import { lampStates } from '../src/scene/cockpitLamps'
import layout from '../src/sim/model-layout.json'

const binary = readFileSync(new URL('../public/models/a320/cockpit.glb', import.meta.url))
const gltf = JSON.parse(binary.toString('utf8', 20, 20 + binary.readUInt32LE(12))) as {
  nodes: { name: string; mesh: number }[]
  meshes: { primitives: { material: number; attributes: { POSITION: number } }[] }[]
  materials: { alphaMode?: string; pbrMetallicRoughness: { baseColorFactor: number[] } }[]
  accessors: { count: number; min: number[]; max: number[] }[]
}
const names = gltf.nodes.map(node => node.name)

describe('Imported cockpit asset integrity', () => {
  it('retains the original lettering layers for the MCDU, pedestal, FCU, clock and overhead', () => {
    for (const name of ['pedestal_low_glare', 'fcu_panel_emit', 'fcu_labels', 'clock_glare', 'ovh_acp_glare', 'fd_main.001']) {
      expect(names).toContain(name)
      expect(hideStaticCockpitPart(name), `Permanent markings must remain visible: ${name}`).toBe(false)
    }
  })

  it('retains the opaque shell below the glareshield instead of treating it as a lamp', () => {
    const shell = gltf.nodes.find(node => node.name === 'pedestal_low_glare.001')!
    expect(shell).toBeDefined()
    expect(hideStaticCockpitPart(shell.name)).toBe(false)
    for (const primitive of gltf.meshes[shell.mesh].primitives) {
      const material = gltf.materials[primitive.material]
      expect(material.alphaMode).not.toBe('BLEND')
      expect(material.pbrMetallicRoughness.baseColorFactor[3]).toBe(1)
      expect(gltf.accessors[primitive.attributes.POSITION].count).toBeGreaterThan(100)
    }
  })

  it('keeps inactive warning lamps hidden without removing their physical buttons', () => {
    expect(hideStaticCockpitPart('BatteryBtn1')).toBe(false)
    expect(hideStaticCockpitPart('BatteryBtn11F')).toBe(true)
    expect(hideStaticCockpitPart('engine_fire_l')).toBe(true)
  })

  it('recognizes all 72 keys on both physical MCDUs, including the decimal keys', () => {
    const captain = names.filter(name => name.endsWith('.cpt') && isMcduKey(name))
    const firstOfficer = names.filter(name => name.endsWith('.fo') && isMcduKey(name))
    expect(captain).toHaveLength(72)
    expect(firstOfficer.map(mcduKey).sort()).toEqual(captain.map(mcduKey).sort())
    for (const name of captain) expect(layout.parts).toHaveProperty(name)
    expect(mcduKey('.cpt')).toBe('.')
    expect(mcduKey('.fo')).toBe('.')
    expect(mcduKeyLabel('R1.fo')).toBe('MCDU LSK1R')
    expect(isMcduKey('audio_vhf1.cpt')).toBe(false)
    expect(isMcduKey('mcdu1.screen')).toBe(false)
    expect(isMcduKey(undefined)).toBe(false) // Batched static surfaces have no sourceName.
  })
})


describe('Physical control registration',()=>{
  it('maps every functional control to an existing model mesh and physical coordinate',()=>{
    for(const name of Object.keys(controls)) {
      expect(names, name).toContain(name)
      expect(layout.parts, name).toHaveProperty(name)
    }
  })
  it('has a source pivot for every animated selector and lever',()=>{
    for(const name of Object.keys(controlRotations(initialState()))) {
      const axis=name.startsWith('thr_')||name.startsWith('rev_')?'trim.axis':name==='FlapsLever_low'?'FlapsLever.axis':`${name}.axis`
      expect(layout.axes,axis).toHaveProperty(axis)
    }
  })
  it('leaves legends visible in cold-and-dark, and powers annunciators from system state',()=>{
    const s=initialState()
    expect(lampStates(s).BatteryBtn12O).toBe(false)
    const on=simReducer(s,{type:'battery',index:0})
    expect(lampStates(on).BatteryBtn22O).toBe(true)
    const test=simReducer(on,{type:'lampTest',active:true})
    expect(lampStates(test).Gen1Btn1F).toBe(true)
    expect(lampStates(simReducer(test,{type:'lampTest',active:false})).Gen1Btn1F).toBe(false)
  })
})

it('retains unlit APU legends independently of their illuminated state',()=>{
  const lamps=lampStates(initialState())
  for(const name of ['APUMasterBtn1F','APUMasterBtn2O','APUStartBtn1A','APUStartBtn2O']) {
    expect(names).toContain(name)
    expect(lamps).toHaveProperty(name,false)
  }
  let s=initialState(true)
  s=simReducer(s,{type:'apuMaster'})
  expect(lampStates(s).APUMasterBtn2O).toBe(true)
  expect(lampStates(s).APUMasterBtn1F).toBe(false)
})
