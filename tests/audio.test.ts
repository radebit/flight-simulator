import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { FlightAudio } from '../src/audio/FlightAudio'
import { initialState, simReducer } from '../src/sim/engine'
class Param { value = 0; setTargetAtTime(value:number) { this.value=value } }
class Node { connect=vi.fn(); disconnect=vi.fn() }
class Gain extends Node { gain=new Param() }
class Source extends Node { buffer:unknown; loop=false; playbackRate=new Param(); start=vi.fn(); stop=vi.fn(); onended:unknown }
class Context {
  static latest:Context
  state='suspended';currentTime=0;destination=new Node();sources:Source[]=[];gains:Gain[]=[]
  resume=vi.fn(async()=>{this.state='running'});close=vi.fn(async()=>{this.state='closed'})
  constructor(){Context.latest=this}
  createGain(){const g=new Gain();this.gains.push(g);return g}
  createDynamicsCompressor(){return Object.assign(new Node(),{threshold:new Param(),ratio:new Param()})}
  createBufferSource(){const s=new Source();this.sources.push(s);return s}
  createStereoPanner(){return Object.assign(new Node(),{pan:new Param()})}
  decodeAudioData=vi.fn(async()=>({duration:2}))
}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
const active={enabled:true,volume:.4,active:true,exterior:false}
async function mixer(){
  vi.stubGlobal('AudioContext',Context)
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(12)})))
  const status=vi.fn(),audio=new FlightAudio(status)
  audio.unlock()
  await vi.waitFor(()=>expect(status).toHaveBeenCalledWith('ready'))
  return {audio,ctx:Context.latest}
}
describe('Audio mixer lifecycle',()=>{
  it.each(['/', '/training/demo/'])('loads all samples with deployment base %s',async(base)=>{
    vi.stubEnv('BASE_URL',base)
    const {audio}=await mixer()
    expect(vi.mocked(fetch).mock.calls).toHaveLength(18)
    for(const [url] of vi.mocked(fetch).mock.calls) {
      expect(String(url).startsWith(`${base}audio/a320/`)).toBe(true)
      expect(url).toMatch(/\/[a-zA-Z]+\.wav$/)
    }
    audio.dispose()
  })
  it('unlocks from a gesture, loads samples once, and starts ventilation only when powered',async()=>{
    const {audio,ctx}=await mixer()
    audio.update(initialState(),active)
    expect(ctx.sources).toHaveLength(0)
    audio.update(initialState(true),active)
    expect(ctx.sources.some(s=>s.loop&&s.start.mock.calls.length)).toBe(true)
    const requests=vi.mocked(fetch).mock.calls.length
    audio.unlock();expect(vi.mocked(fetch).mock.calls.length).toBe(requests)
    audio.dispose();expect(ctx.close).toHaveBeenCalledOnce()
    expect(ctx.sources.filter(s=>s.loop).every(s=>s.stop.mock.calls.length)).toBe(true)
  })
  it('mutes ongoing loops and suppresses new clicks while paused, hidden or muted',async()=>{
    const {audio,ctx}=await mixer()
    audio.update(initialState(true),active)
    audio.oneShot('key')
    expect(ctx.gains[0].gain.value).toBe(.4)
    audio.update(initialState(true),{...active,active:false})
    expect(ctx.gains[0].gain.value).toBe(0)
    const before=ctx.sources.length
    audio.oneShot('button');expect(ctx.sources).toHaveLength(before)
    audio.update(initialState(true),{...active,enabled:false})
    expect(ctx.gains[0].gain.value).toBe(0)
    audio.dispose()
  })
  it('keeps loop voice count bounded over updates and silences the fire tone when the key is released',async()=>{
    const {audio,ctx}=await mixer()
    let s=simReducer(initialState(true),{type:'fireTest',index:1,active:true})
    audio.update(s,active)
    const voices=ctx.sources.filter(s=>s.loop).length
    for(let i=0;i<100;i++) audio.update(s,active)
    expect(ctx.sources.filter(s=>s.loop)).toHaveLength(voices)
    const crcGain=ctx.gains.find(g=>g.gain.value===.22)!
    expect(crcGain).toBeDefined()
    s=simReducer(s,{type:'fireTest',index:1,active:false});audio.update(s,active)
    expect(crcGain.gain.value).toBe(0)
    audio.dispose()
  })
})
describe('Distributed sound assets',()=>{
  it('ships every referenced original WAV with nonempty PCM audio and source attribution',()=>{
    const manifest=JSON.parse(readFileSync(new URL('../public/audio/a320/sources.json',import.meta.url),'utf8'))
    expect(manifest.license).toBe('GPL-2.0')
    expect(Object.keys(manifest.assets)).toHaveLength(18)
    for(const key of Object.keys(manifest.assets)) {
      const wav=readFileSync(new URL(`../public/audio/a320/${key}.wav`,import.meta.url))
      expect(wav.toString('ascii',0,4),key).toBe('RIFF')
      expect(wav.toString('ascii',8,12),key).toBe('WAVE')
      let offset=12, data:Buffer|undefined
      while(offset+8<=wav.length) {const size=wav.readUInt32LE(offset+4);if(wav.toString('ascii',offset,offset+4)==='data')data=wav.subarray(offset+8,offset+8+size);offset+=8+size+(size%2)}
      expect(data?.length,key).toBeGreaterThan(1000)
      expect(data?.some(value=>value!==0),key).toBe(true)
    }
  })
})
