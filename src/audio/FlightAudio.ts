import { AC_POWER, DC_POWER, FIRE_WARNING, HYD_PRESSURE, PACK_FLOW, STARTER_OPEN, type Action, type SimState } from '../sim/engine'
import { assetUrl } from '../assetUrl'

const samples = ['button', 'key', 'switch', 'knob', 'detent', 'relay', 'chime', 'crc', 'fan', 'pack', 'apuIn', 'apuOut', 'engineIn', 'engineOut', 'spool', 'starter', 'flaps', 'ptu'] as const
type Sample = typeof samples[number]
type Loop = { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode }
export type AudioStatus = 'idle' | 'loading' | 'ready' | 'unavailable'
export type AudioSettings = { enabled: boolean; volume: number; active: boolean; exterior: boolean }

/** A single real-time mixer; training time changes the aircraft, never the playback clock. */
export class FlightAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private buffers = new Map<Sample, AudioBuffer>()
  private loops = new Map<string, Loop>()
  private shots = new Set<AudioBufferSourceNode>()
  private disposed = false
  private request = new AbortController()
  private settings: AudioSettings = { enabled: true, volume: .55, active: false, exterior: false }
  private state: SimState | null = null
  private lastPower = false
  private lastBelts = false
  private status: AudioStatus = 'idle'
  constructor(private onStatus: (status: AudioStatus) => void = () => {}) {}

  /** Must be called by a click/key gesture, including when resuming a suspended browser context. */
  unlock() {
    if (this.disposed) return
    try {
      if (!this.context) {
        this.context = new AudioContext()
        this.master = this.context.createGain()
        this.master.gain.value = 0
        this.compressor = this.context.createDynamicsCompressor()
        this.compressor.threshold.value = -10; this.compressor.ratio.value = 4
        this.master.connect(this.compressor); this.compressor.connect(this.context.destination)
        this.status = 'loading'; this.onStatus(this.status)
        void this.load()
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => { this.onStatus('unavailable') })
    } catch { this.status = 'unavailable'; this.onStatus(this.status) }
  }
  private async load() {
    const results = await Promise.allSettled(samples.map(async sample => {
      const response = await fetch(assetUrl(`audio/a320/${sample}.wav`), { signal: this.request.signal })
      if (!response.ok) throw new Error(`Audio ${sample}: ${response.status}`)
      const buffer = await this.context!.decodeAudioData(await response.arrayBuffer())
      if (!this.disposed) this.buffers.set(sample, buffer)
    }))
    if (this.disposed) return
    this.status = results.every(r => r.status === 'fulfilled') ? 'ready' : 'unavailable'
    this.onStatus(this.status)
    if (this.state) this.update(this.state, this.settings)
  }
  update(s: SimState, settings: AudioSettings) {
    this.state = s; this.settings = settings
    const ctx = this.context
    if (!ctx || !this.master) return
    const audible = settings.enabled && settings.active
    this.master.gain.setTargetAtTime(audible ? Math.max(0, Math.min(1, settings.volume)) : 0, ctx.currentTime, .08)
    if (!audible) { for (const source of this.shots) { try { source.stop() } catch { /* Already finished. */ } }; this.shots.clear() }
    const outside = settings.exterior, dc = DC_POWER(s), ac = AC_POWER(s)
    this.loop('fan', 'fan', ac && s.systems.cabinFans ? outside ? .012 : .12 : 0, 1)
    this.loop('pack', 'pack', (Number(PACK_FLOW(s, 0)) + Number(PACK_FLOW(s, 1))) * (outside ? .02 : .12), 1)
    this.loop('apu-in', 'apuIn', Math.pow(s.apuRpm / 100, 2) * (outside ? .015 : .15), .55 + s.apuRpm / 200)
    this.loop('apu-out', 'apuOut', Math.pow(s.apuRpm / 100, 2) * (outside ? .32 : 0), .55 + s.apuRpm / 200)
    for (const i of [0, 1]) {
      const rpm = s.engineN2[i] / 68, pan = i ? .5 : -.5
      this.loop(`engine-in-${i}`, 'engineIn', rpm * (outside ? 0 : .19) * (1 + s.throttle / 130), .65 + rpm * .35 + s.throttle / 160, pan)
      this.loop(`engine-out-${i}`, 'engineOut', rpm * (outside ? .34 : 0) * (1 + s.throttle / 130), .65 + rpm * .35 + s.throttle / 160, pan)
      this.loop(`spool-${i}`, 'spool', rpm > .02 && rpm < .96 ? Math.sin(rpm * Math.PI) * .23 : 0, .55 + rpm * .6, pan)
      this.loop(`starter-${i}`, 'starter', STARTER_OPEN(s, i) ? .16 : 0, .8 + rpm * .4, pan)
    }
    this.loop('flaps', 'flaps', Math.abs(s.flaps - s.systems.actualFlaps) > .02 && (HYD_PRESSURE(s, 0) > 0 || HYD_PRESSURE(s, 2) > 0) ? .13 : 0, 1)
    const pressureDifference = (s.engineN2[0] > 45) !== (s.engineN2[1] > 45)
    this.loop('ptu', 'ptu', s.engineMaster.every(Boolean) && pressureDifference && s.systems.ptu ? .13 : 0, 1)
    this.loop('crc', 'crc', FIRE_WARNING(s) ? .22 : 0, 1)
    if (audible && ac !== this.lastPower) this.oneShot('relay', .35)
    if (audible && dc && s.seatbelts !== this.lastBelts) this.oneShot('chime', .3)
    this.lastPower = ac; this.lastBelts = s.seatbelts
  }
  private loop(id: string, sample: Sample, level: number, rate: number, pan = 0) {
    const ctx = this.context, buffer = this.buffers.get(sample)
    if (!ctx || !buffer || !this.master) return
    let loop = this.loops.get(id)
    if (!loop) {
      if (level <= 0) return // Do not allocate unused voices in cold & dark.
      const source = ctx.createBufferSource(), gain = ctx.createGain(), panner = ctx.createStereoPanner()
      source.buffer = buffer; source.loop = true; gain.gain.value = 0; panner.pan.value = pan
      source.connect(gain); gain.connect(panner); panner.connect(this.master); source.start()
      loop = { source, gain, pan: panner }; this.loops.set(id, loop)
    }
    loop.gain.gain.setTargetAtTime(level, ctx.currentTime, .22)
    loop.source.playbackRate.setTargetAtTime(Math.max(.3, rate), ctx.currentTime, .3)
  }
  oneShot(sample: Sample, level = .55) {
    if (!this.settings.enabled || !this.settings.active || this.disposed) return
    this.unlock()
    const ctx = this.context, buffer = this.buffers.get(sample)
    if (!ctx || !buffer || !this.master) return
    const source = ctx.createBufferSource(), gain = ctx.createGain()
    source.buffer = buffer; gain.gain.value = level; source.connect(gain); gain.connect(this.master)
    this.shots.add(source)
    source.onended = () => { source.disconnect(); gain.disconnect(); this.shots.delete(source) }
    source.start()
  }
  action(action: Action) {
    if (['tick', 'reset', 'notice', 'plan'].includes(action.type)) return
    const kind = ['fcu', 'brightness'].includes(action.type) ? 'knob' : ['throttle', 'flaps', 'parkingBrake'].includes(action.type) ? 'detent' : ['selector', 'ir', 'engine', 'ignition', 'beacon', 'seatbelts', 'navLights'].includes(action.type) ? 'switch' : 'button'
    this.oneShot(kind)
  }
  dispose() {
    this.disposed = true; this.request.abort()
    for (const { source, gain, pan } of this.loops.values()) { source.stop(); source.disconnect(); gain.disconnect(); pan.disconnect() }
    for (const source of this.shots) { try { source.stop() } catch { /* Ended. */ }; source.disconnect() }
    this.loops.clear(); this.shots.clear(); this.buffers.clear(); this.master?.disconnect(); this.compressor?.disconnect()
    if (this.context && this.context.state !== 'closed') void this.context.close()
    this.context = null
  }
}
