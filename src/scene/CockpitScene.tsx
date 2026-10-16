import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { ArrowUpRight, Move, RotateCcw, MousePointer2 } from 'lucide-react'
import type { View } from '../sim/aircraft'
import { AC_POWER, ALIGNED, DC_POWER, initialState, formatTime, ECAM_PAGE, PACK_FLOW, fuelFlow, type Action, type SimState } from '../sim/engine'
import { Airplane, AssetLoading, SceneBoundary } from './AircraftScene'
import { prepareModel, disposeModel } from './modelAssets'
import { hideStaticCockpitPart } from './cockpitVisibility'
import { AirportEnvironment, AircraftLights, type TimeOfDay } from './AirportEnvironment'
import { lampStates, persistentLamps, hasUnlitLegend } from './cockpitLamps'
import { separateOverheadButtonFaces, BUTTON_PRESS_TRAVEL } from './cockpitButtonGeometry'
import { AIRPORT_IN_COCKPIT } from './aircraftCoordinates'
import { drawEcam } from './ecamDisplays'
import { ControlProjection } from './ControlProjection'
import { controls, axes, controlLayout, controlValue, controlAction, isAdjustable, controlRotations } from './cockpitControls'
import { isMcduKey, mcduKey, mcduKeyLabel, useMcdu, type McduScreenState } from '../sim/useMcdu'
import { assetUrl } from '../assetUrl'

type CameraPreset = 'captain' | 'overview' | 'overhead' | 'main' | 'pedestal' | 'mcdu' | 'overheadFront' | 'overheadRear' | 'overheadApu'
const cameraPresets: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number]; fov: number }> = {
  overheadFront: { position: [.34, .26, 0], target: [.12, 1.015, 0], fov: 65 },
  overheadRear: { position: [1.05, .5, 0], target: [.82, 1.22, 0], fov: 58 },
  overheadApu: { position: [.03, .48, 0], target: [-.13, .93, 0], fov: 49 },
  mcdu: { position: [-.08, .30, .185], target: [-.36, -.071, .185], fov: 42 },
  captain: { position: [.24, .62, .52], target: [-.55, .30, .35], fov: 76 },
  overview: { position: [.91, .64, .06], target: [-.3, .44, 0], fov: 86 },
  overhead: { position: [.82, .10, 0], target: [.35, 1.07, 0], fov: 76 },
  main: { position: [.35, .38, .02], target: [-.53, .22, 0], fov: 74 },
  pedestal: { position: [.36, .51, .11], target: [-.14, -.10, 0], fov: 64 },
}
const lampNames = [...new Set([...Object.keys(lampStates(initialState())), ...Object.keys(controlLayout).filter(hasUnlitLegend)])]
const pushbuttonNames = new Set(lampNames.filter(hasUnlitLegend).map(name => name.replace(/[12][A-Z]$/, '')))
const illuminatedMarkings = ['fcu_panel_emit', 'pedestal_low_glare', 'ovh_acp_glare']
const screenKinds: Record<string, string> = { 'pfd1.screen': 'pfd', 'pfd2.screen': 'pfd', 'ND.screen': 'nd', 'ND_R.screen': 'nd', 'uecam.screen': 'engine', 'lecam.screen': 'system', 'mcdu1.screen': 'mcdu', 'mcdu2.screen': 'mcdu', 'batt_voltage.canvas.L': 'voltage0', 'batt_voltage.canvas.R': 'voltage1' }
const hidePart = (name: string) => {
  if (lampNames.includes(name) || screenKinds[name] || controls[name]) return false
  return hideStaticCockpitPart(name)
}
function useDisplayTexture(s: SimState, kind: string, mcdu?: McduScreenState) {
  const canvas = useMemo(() => document.createElement('canvas'), [])
  const texture = useMemo(() => { canvas.width = 512; canvas.height = 480; const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; return t }, [canvas])
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => {
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#040a09'; ctx.fillRect(0, 0, 512, 480)
    if (kind.startsWith('voltage')) {
      const index = kind === 'voltage0' ? 0 : 1
      ctx.fillStyle = '#9de4a4'; ctx.font = '190px monospace'; ctx.textAlign = 'center'; ctx.fillText(s.batteries[index] && AC_POWER(s) ? '28.0' : '25.4', 256, 320); ctx.textAlign = 'left'
    } else if (AC_POWER(s)) {
      ctx.globalAlpha = s.systems.displayBrightness
      ctx.font = '20px monospace'; ctx.fillStyle = '#65e98a'
      if (kind === 'pfd') {
        ctx.fillText(s.fcu.fd ? '             1 FD 2' : '', 20, 28)
        if (ALIGNED(s)) {
          ctx.fillStyle = '#4d9bbb'; ctx.fillRect(100, 95, 310, 137); ctx.fillStyle = '#a16c40'; ctx.fillRect(100, 232, 310, 143)
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(100, 232); ctx.lineTo(410, 232); ctx.stroke()
          for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(215, 140 + i * 45); ctx.lineTo(295, 140 + i * 45); ctx.stroke() }
          ctx.strokeStyle = '#ffff73'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(130, 235); ctx.lineTo(210, 235); ctx.lineTo(210, 250); ctx.moveTo(300, 250); ctx.lineTo(300, 235); ctx.lineTo(380, 235); ctx.stroke()
        } else { ctx.fillStyle = '#f6b963'; ctx.font = '36px monospace'; ctx.fillText('ATT', 225, 230); ctx.font = '18px monospace'; ctx.fillText('IRS IN ALIGN', 185, 275) }
        ctx.fillStyle = '#333c39'; ctx.fillRect(15, 95, 62, 280); ctx.fillRect(435, 95, 62, 280)
        ctx.fillStyle = '#fff'; ctx.font = '24px monospace'; ctx.fillText('000', 20, 244); ctx.fillText('000', 442, 244)
        ctx.fillStyle = '#71d8f0'; ctx.fillText(String(s.fcu.speed), 18, 76); ctx.fillText(String(s.fcu.altitude), 405, 76); ctx.fillText('QNH 1013', 345, 443)
      } else if (kind === 'nd') {
        ctx.fillText('GS 0   TAS ---', 20, 28); ctx.fillText(s.flightPlan.fromTo.split('/')[1] || '----', 390, 28)
        ctx.strokeStyle = '#b1c0b2'; ctx.lineWidth = 2
        for (const r of [70, 125, 180, 235]) { ctx.beginPath(); ctx.arc(256, 370, r, Math.PI, 0); ctx.stroke() }
        ctx.fillStyle = '#fff75a'; ctx.fillText('▲', 243, 365)
        if (s.systems.chrono !== 'OFF') { ctx.fillStyle = '#f0f2e6'; ctx.fillText(`CHR ${formatTime(s.systems.chronoTime)}`, 20, 455) }
        if (!ALIGNED(s)) { ctx.fillStyle = '#f6b963'; ctx.fillText('MAP NOT AVAIL', 180, 230) }
      } else if (kind === 'mcdu' && mcdu) {
        ctx.globalAlpha = mcdu.brightness
        ctx.textBaseline = 'alphabetic'; ctx.font = '24px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#f0f3e8'; ctx.fillText(mcdu.page === 'F-PLN' ? 'FLIGHT PLAN' : mcdu.page, 256, 30)
        ctx.textAlign = 'left'
        if (mcdu.page === 'INIT') {
          const rows = [
            ['CO RTE', 'FROM/TO', 'NONE', s.flightPlan.fromTo || '□□□□/□□□□'],
            ['ALTN/CO RTE', '', 'NONE', ''],
            ['FLT NBR', '', s.flightPlan.flightNo || '□□□□□□', ''],
            ['LAT', 'LONG', '31°08.6N', '121°48.3E'],
            ['COST INDEX', '', s.flightPlan.costIndex || '□□□', ''],
            ['CRZ FL/TEMP', 'TROPO', s.flightPlan.cruiseLevel ? `FL${s.flightPlan.cruiseLevel}` : '□□□□□', '36090'],
          ]
          rows.forEach((row, i) => {
            const y = 61 + i * 58
            ctx.fillStyle = '#e7eae4'; ctx.font = '17px monospace'; ctx.textAlign = 'left'; ctx.fillText(row[0], 14, y); ctx.textAlign = 'right'; ctx.fillText(row[1], 498, y)
            ctx.font = '24px monospace'; ctx.fillStyle = row[2].includes('□') ? '#f3ba64' : '#65cdec'; ctx.textAlign = 'left'; ctx.fillText(row[2], 14, y + 26)
            ctx.fillStyle = row[3].includes('□') ? '#f3ba64' : '#65cdec'; ctx.textAlign = 'right'; ctx.fillText(row[3], 498, y + 26)
          })
        } else {
          const rows = mcdu.page === 'F-PLN' ? ['FROM', s.flightPlan.fromTo.split('/')[0] || '----', 'DEST', s.flightPlan.fromTo.split('/')[1] || '----', 'TRAINING ROUTE ONLY', 'NAV DATA NOT INSTALLED'] : mcdu.page === 'DATA' ? ['A/C TYPE', 'A320-251N', 'ENGINE TYPE', 'CFM LEAP-1A', 'NAV DATABASE', 'NOT INSTALLED'] : mcdu.page === 'PERF' ? ['TAKE OFF', 'V1 -- / VR -- / V2 --', 'FLAPS', String(s.flaps), 'PERFORMANCE DATABASE', 'NOT INSTALLED'] : ['THIS PAGE IS NOT', 'IMPLEMENTED YET', '', 'USE INIT FOR', 'FLIGHT PREPARATION', '']
          rows.forEach((line, i) => { ctx.textAlign = 'left'; ctx.font = i % 2 === 0 ? '18px monospace' : '23px monospace'; ctx.fillStyle = i % 2 === 0 ? '#e7eae4' : '#65cdec'; ctx.fillText(line, 18, 75 + i * 52) })
        }
        ctx.textAlign = 'left'; ctx.fillStyle = mcdu.error ? '#f2b35e' : '#f0f2e9'; ctx.font = '22px monospace'; ctx.fillText(mcdu.error || mcdu.scratch || '[                      ]', 14, 459)
        ctx.globalAlpha = 1
      } else {
        drawEcam(ctx, s, kind === 'engine')
      }
    }
    ctx.globalAlpha = 1

    texture.needsUpdate = true
  }, [s, canvas, texture, kind, mcdu])
  return texture
}

function DigitalLabel({ value, label, position, width = .032, height = .016, powered }: { value: string; label?: string; position: [number, number, number]; width?: number; height?: number; powered: boolean }) {
  const canvas = useMemo(() => { const c = document.createElement('canvas'); c.width = 384; c.height = 160; return c }, [])
  const texture = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t }, [canvas])
  const rotation = useMemo(() => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-.296, .9552, 0), new THREE.Vector3(.9552, .296, 0))), [])
  useEffect(() => {
    const c = canvas.getContext('2d')!; c.clearRect(0, 0, 384, 160)
    if (powered) { c.fillStyle = '#ffd887'; c.textAlign = 'center'; c.font = '25px monospace'; if (label) c.fillText(label, 192, 33); c.font = '76px monospace'; c.fillText(value, 192, 123) }
    texture.needsUpdate = true
  }, [canvas, texture, value, label, powered])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={position} quaternion={rotation}><planeGeometry args={[width, height]} /><meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} /></mesh>
}

function FlightDeck({ state: s, onHover, operate, mcdu, focusMcdu, onReady, presses, hold }: { state: SimState; onHover: (name: string) => void; operate: (name: string, direction?: number) => void; mcdu: McduScreenState; focusMcdu: () => void; onReady: (ready: boolean) => void; presses: Map<string, number>; hold: (name: string) => void }) {
  const { scene } = useGLTF(assetUrl('models/a320/cockpit.glb'))
  useEffect(() => { onReady(true); return () => onReady(false) }, [onReady])
  const model = useMemo(() => {
    const prepared = prepareModel(scene, { keep: name => !!controls[name] || pushbuttonNames.has(name) || !!screenKinds[name] || lampNames.includes(name) || illuminatedMarkings.includes(name) || isMcduKey(name) || ['thr_r_body', 'thr_l_button', 'thr_r_button', 'rev_l', 'rev_r', 'FlapsLever_low'].includes(name) || name.endsWith('.mark') && !!controls[name.slice(0, -5)], hide: hidePart })
    separateOverheadButtonFaces(prepared.parts)
    const dimTextures = new Map<THREE.Texture, THREE.CanvasTexture>()
    for (const [name, mesh] of prepared.parts) {
      if (mesh instanceof THREE.Mesh && hasUnlitLegend(name)) {
        const material = mesh.material as THREE.MeshStandardMaterial, original = material.map
        if (original) {
          let dim = dimTextures.get(original)
          if (!dim) {
            const canvas = document.createElement('canvas'), image = original.image as HTMLImageElement | ImageBitmap
            canvas.width = image.width; canvas.height = image.height
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(image, 0, 0)
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
            for (let i = 0; i < pixels.data.length; i += 4) {
              // Equal dark-state contrast for blue ON, green AVAIL and amber
              // FAULT legends; luminance grayscale makes pure blue disappear.
              const gray = Math.max(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]) * .56
              pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray
            }
            ctx.putImageData(pixels, 0, 0)
            dim = new THREE.CanvasTexture(canvas); dim.flipY = original.flipY; dim.colorSpace = THREE.SRGBColorSpace; dim.anisotropy = 8
            dimTextures.set(original, dim)
          }
          mesh.userData.litMap = original; mesh.userData.unlitMap = dim
        }
      }
      const axisName = name.startsWith('thr_') || /^rev_[lr]$/.test(name) ? 'trim.axis' : name === 'FlapsLever_low' ? 'FlapsLever.axis' : `${name.replace(/\.mark$/, '')}.axis`
      const axis = axes[axisName]
      mesh.userData.basePosition = mesh.position.clone()
      if (axis && mesh instanceof THREE.Mesh) { mesh.geometry.translate(-axis.pivot[0], -axis.pivot[1], -axis.pivot[2]); mesh.position.set(...axis.pivot); mesh.userData.axis = axis.direction; mesh.userData.basePosition = mesh.position.clone() }
    }
    prepared.root.userData.dimTextures = [...dimTextures.values()]
    return prepared
  }, [scene])
  const pfd = useDisplayTexture(s, 'pfd'), nd = useDisplayTexture(s, 'nd'), engine = useDisplayTexture(s, 'engine'), system = useDisplayTexture(s, 'system'), mcduTexture = useDisplayTexture(s, 'mcdu', mcdu), voltage0 = useDisplayTexture(s, 'voltage0'), voltage1 = useDisplayTexture(s, 'voltage1')
  useEffect(() => {
    const textures: Record<string, THREE.Texture> = { pfd, nd, engine, system, mcdu: mcduTexture, voltage0, voltage1 }
    for (const [name, kind] of Object.entries(screenKinds)) {
      const object = model.parts.get(name) as THREE.Mesh | undefined
      if (object) { (object.material as THREE.Material).dispose(); object.material = new THREE.MeshBasicMaterial({ map: textures[kind], toneMapped: false, side: THREE.DoubleSide }); object.renderOrder = 2 }
    }
    return () => { disposeModel(model.root); (model.root.userData.dimTextures as THREE.Texture[]).forEach(texture => texture.dispose()) }
  }, [model, pfd, nd, engine, system, mcduTexture, voltage0, voltage1])
  useEffect(() => {
    const values = lampStates(s)
    for (const name of lampNames) {
      const part = model.parts.get(name) as THREE.Mesh | undefined
      if (!part) continue
      const lit = values[name] ?? (s.systems.lampTest && DC_POWER(s))
      part.visible = persistentLamps.has(name) || hasUnlitLegend(name) || lit
      const material = part.material as THREE.MeshStandardMaterial
      if (part.userData.litMap) material.map = lit ? part.userData.litMap : part.userData.unlitMap
      material.emissive?.set('#ffffff'); material.emissiveIntensity = lit ? .9 : 0
      if (material.map) material.emissiveMap = material.map
    }
    for (const name of illuminatedMarkings) {
      const part = model.parts.get(name) as THREE.Mesh | undefined
      if (!part) continue
      const material = part.material as THREE.MeshStandardMaterial
      material.emissive?.set('#ffe6b9'); material.emissiveMap = material.map
      material.emissiveIntensity = AC_POWER(s) ? s.systems.integralBrightness * .65 : 0
    }
  }, [model, s])
  const rotations = useMemo(() => controlRotations(s), [s])
  const quaternion = useMemo(() => new THREE.Quaternion(), [])
  const axisVector = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const now = performance.now()
    for (const [name, object] of model.parts) {
      const baseName = name.replace(/\.mark$/, '')
      const angle = rotations[baseName]
      if (angle !== undefined && object.userData.axis) {
        quaternion.setFromAxisAngle(axisVector.fromArray(object.userData.axis), THREE.MathUtils.degToRad(angle))
        object.quaternion.slerp(quaternion, 1 - Math.exp(-18 * dt))
      } else {
        const parent = controls[name] || isMcduKey(name) ? name : Object.keys(controls).find(key => name.startsWith(key))
        const held = parent ? presses.get(parent) : undefined
        const pressed = held !== undefined && (held === Infinity || now - held < 160)
        const base = object.userData.basePosition as THREE.Vector3
        if (!base) continue
        // Overhead buttons travel into the ceiling, pedestal keys down into their panel.
        const overhead = parent && controls[parent]?.panel === 'overhead'
        const travel = pressed ? BUTTON_PRESS_TRAVEL : 0
        object.position.x = THREE.MathUtils.damp(object.position.x, base.x + (overhead ? -.36 : -.2) * travel, 25, dt)
        object.position.y = THREE.MathUtils.damp(object.position.y, base.y + (overhead ? .93 : -.98) * travel, 25, dt)
      }
    }
  })
  const sourceName = (object: THREE.Object3D) => {
    const name = object.userData.sourceName as string
    if (!name) return ''
    return controls[name] || isMcduKey(name) ? name : Object.keys(controls).find(key => name.startsWith(key) && /[12][A-Z]$/.test(name)) || name
  }
  return <>
    <primitive object={model.root} onPointerDown={(e: ThreeEvent<PointerEvent>) => { const name = sourceName(e.object); if (controls[name]?.momentary) { e.stopPropagation(); hold(name) } }} onPointerOver={(e: ThreeEvent<PointerEvent>) => { const name = sourceName(e.object); if (controls[name] || isMcduKey(name) || name?.startsWith('mcdu')) { e.stopPropagation(); onHover(name); document.body.style.cursor = 'pointer' } }} onPointerOut={() => { onHover(''); document.body.style.cursor = '' }} onClick={(e: ThreeEvent<MouseEvent>) => {
      const name = sourceName(e.object)
      if (controls[name] || isMcduKey(name)) { e.stopPropagation(); if (!controls[name]?.momentary) operate(name, e.shiftKey ? -1 : 1) }
      else if (name?.startsWith('mcdu')) { e.stopPropagation(); focusMcdu() }
    }} onWheel={(e: ThreeEvent<WheelEvent>) => { const name = sourceName(e.object); if (isAdjustable(name)) { e.stopPropagation(); operate(name, e.deltaY < 0 ? 1 : -1) } }} />
    <DigitalLabel powered={AC_POWER(s)} label="SPD" value={String(s.fcu.speed)} position={[-.3755, .5055, .08943]} />
    <DigitalLabel powered={AC_POWER(s)} label="HDG" value={String(s.fcu.heading).padStart(3, '0')} position={[-.3755, .5055, .04941]} />
    <DigitalLabel powered={AC_POWER(s)} label="ALT" value={String(s.fcu.altitude).padStart(5, '0')} width={.041} position={[-.3755, .5055, -.0432]} />
    <DigitalLabel powered={AC_POWER(s)} label="V/S" value="-----" width={.035} position={[-.3755, .5055, -.087]} />
  </>
}

function CameraControls({ preset, reset, zoomEnabled, motion }: { preset: CameraPreset; reset: number; zoomEnabled: boolean; motion: RefObject<boolean> }) {
  const controls = useRef<OrbitControlsImpl | null>(null)
  const { camera, gl, size } = useThree()
  const animating = motion
  const destination = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    camera.up.set(preset.startsWith('overhead') ? 1 : 0, preset.startsWith('overhead') ? 0 : 1, 0)
    const next = new OrbitControlsImpl(camera, gl.domElement)
    next.enableDamping = true; next.minDistance = .12; next.maxDistance = 2.2; next.zoomSpeed = .5; next.rotateSpeed = .5; next.panSpeed = .35
    next.target.copy(target)
    const stop = () => { animating.current = false }
    next.addEventListener('start', stop); controls.current = next
    return () => { next.removeEventListener('start', stop); next.dispose(); controls.current = null }
  }, [camera, gl, preset, target])
  useEffect(() => {
    const p = cameraPresets[preset]; destination.set(...p.position); target.set(...p.target); animating.current = true
    if (camera instanceof THREE.PerspectiveCamera) {
      // Preserve the complete panel's horizontal framing in narrow browser panes.
      const minimumAspect = ['main', 'overview', 'captain'].includes(preset) ? 1.38 : .8
      const fit = Math.max(1, minimumAspect / (size.width / size.height))
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(p.fov / 2)) * fit))
      camera.updateProjectionMatrix()
    }
  }, [preset, reset, camera, destination, target, size.width, size.height])
  useEffect(() => { if (controls.current) controls.current.enableZoom = zoomEnabled }, [zoomEnabled, preset])
  useFrame((_, dt) => {
    if (!controls.current) return
    if (animating.current) {
      camera.position.lerp(destination, 1 - Math.exp(-8 * dt)); controls.current.target.lerp(target, 1 - Math.exp(-8 * dt))
      if (camera.position.distanceTo(destination) < .001) animating.current = false
    }
    controls.current.update()
  })
  return null
}

export default function CockpitScene({ state, dispatch, onView, initialView = 'cockpit', highlight, time = 'day', onKeySound }: { state: SimState; dispatch: (action: Action) => void; onView: (view: View) => void; initialView?: View; highlight?: string; time?: TimeOfDay; onKeySound?: () => void }) {
  const initialPreset: CameraPreset = initialView === 'exterior' ? 'overview' : initialView === 'fcu' ? 'main' : initialView === 'cockpit' ? 'overview' : initialView
  const [preset, setPreset] = useState<CameraPreset>(initialPreset)
  const [reset, setReset] = useState(0)
  const [hover, setHover] = useState('')
  const [hints, setHints] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const targets = useMemo(() => new Map<string, HTMLButtonElement>(), [])
  const pendingPreset = useRef<CameraPreset | null>(null)
  const cameraMotion = useRef(false)
  const mcdu = useMcdu(state, dispatch)
  const presses = useMemo(() => new Map<string, number>(), [])
  const held = useRef<string | null>(null)
  const dispatchRef = useRef(dispatch); dispatchRef.current = dispatch
  function release() {
    const name = held.current
    if (!name) return
    const action = controls[name]?.action
    if (action?.type === 'fireTest' || action?.type === 'lampTest') dispatchRef.current({ ...action, active: false })
    presses.delete(name); held.current = null
  }
  function hold(name: string) {
    release()
    const action = controls[name]?.action
    if (action?.type === 'fireTest' || action?.type === 'lampTest') { presses.set(name, Infinity); held.current = name; dispatch(action) }
  }
  useEffect(() => {
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release); window.addEventListener('blur', release)
    return () => { release(); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); window.removeEventListener('blur', release) }
  }, [])
  useEffect(() => { release() }, [preset])
  useEffect(() => { setPreset(pendingPreset.current || initialPreset); pendingPreset.current = null; setReset(v => v + 1) }, [initialPreset])
  useEffect(() => () => { document.body.style.cursor = '' }, [])
  const hoverLabel = controls[hover]?.label || (isMcduKey(hover) ? mcduKeyLabel(hover) : hover.startsWith('mcdu') ? 'MCDU · 点击进入近景' : '')
  function operate(name: string, direction = 1) {
    presses.set(name, performance.now())
    if (isMcduKey(name)) { onKeySound?.(); mcdu.press(mcduKey(name)); return }
    const action = controlAction(name, state, direction)
    if (action) dispatch(action)
  }
  const currentPanel = preset.startsWith('overhead') ? 'overhead' : preset === 'captain' ? 'main' : preset
  function switchCamera(key: CameraPreset) {
    cameraMotion.current = true
    const view: View = key === 'captain' || key === 'overview' ? 'cockpit' : key.startsWith('overhead') ? 'overhead' : key === 'main' ? 'fcu' : key as View
    pendingPreset.current = view !== initialView ? key : null
    onView(view); setPreset(key)
  }
  return <div className={`cockpit-scene detailed-cockpit ${preset === 'mcdu' ? 'mcdu-active' : ''}`} tabIndex={preset === 'mcdu' ? 0 : -1} aria-label={preset === 'mcdu' ? 'MCDU 键盘输入区' : '3D 驾驶舱操作区'} onKeyDown={e => {
    if (preset !== 'mcdu' || e.ctrlKey || e.metaKey || e.altKey) return
    if (/^[a-zA-Z0-9/.]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); operate(`${e.key.toLowerCase()}.cpt`) }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); onKeySound?.(); mcdu.press(e.key === 'Backspace' ? 'clr' : 'delete') }
  }}>
    <div className="scene-corner"><span className="eyebrow">A320 · FLIGHT DECK</span><h2>{({ captain: '机长视角', overview: '完整驾驶舱', overhead: '完整顶板', main: '主仪表板', pedestal: '中央操纵台', mcdu: 'MCDU 1', overheadFront: '前顶板近景', overheadRear: '后顶板近景', overheadApu: 'APU 与灯光' })[preset]}</h2>{preset.startsWith('overhead') && <div className="overhead-framing">{([['overhead', '完整顶板'], ['overheadFront', '前部近景'], ['overheadRear', '后部近景'], ['overheadApu', 'APU / 灯光']] as const).map(([key, label]) => <button key={key} className={preset === key ? 'selected' : ''} onClick={() => { cameraMotion.current = true; setPreset(key) }}>{label}</button>)}</div>}<span>{preset === 'mcdu' ? '点击实体按键 · 支持电脑键盘输入' : '原始布局 · 直接点击模型操作'}</span></div>
    <button className={`scene-atlas-button ${hints ? 'active' : ''}`} aria-label="显示可操作控件" aria-pressed={hints} onClick={() => setHints(v => !v)}><MousePointer2 size={14} />{hints ? '隐藏操作提示' : '操作提示'}</button>
    <SceneBoundary fallback={<div className="scene-fallback"><p>3D 模型加载失败，请刷新重试。</p><a href={assetUrl('models/a320/cockpit.glb')}>检查模型文件 <ArrowUpRight size={16} /></a></div>}><Canvas className="cockpit-canvas" dpr={[1, 1.7]} camera={{ position: cameraPresets.overview.position, fov: 86, near: .006, far: 1000 }} gl={{ antialias: true, logarithmicDepthBuffer: true }}>
      <AirportEnvironment state={state} time={time} cockpit />
      <ambientLight intensity={time === 'night' ? .08 : .55} />
      <pointLight position={[.3,.73,0]} intensity={DC_POWER(state) ? ({OFF: 0, DIM: .35, BRT: 1.2})[state.systems.dome] : 0} decay={1} color="#ffe5bc" />
      <Suspense fallback={null}><FlightDeck state={state} onHover={setHover} operate={operate} mcdu={mcdu.screen} focusMcdu={() => onView('mcdu')} onReady={setModelReady} presses={presses} hold={hold} /></Suspense>
      <Suspense fallback={null}><group position={AIRPORT_IN_COCKPIT}><Airplane state={state} cockpit /><AircraftLights state={state} time={time} /></group></Suspense>
      <CameraControls preset={preset} reset={reset} zoomEnabled={!isAdjustable(hover)} motion={cameraMotion} />
      <ControlProjection targets={targets} cameraMoving={cameraMotion} />
    </Canvas><AssetLoading /></SceneBoundary>
    <div className="cockpit-interaction-layer" hidden={!modelReady}>
    {Object.entries(controlLayout).filter(([name]) => preset === 'mcdu' ? name.endsWith('.cpt') && isMcduKey(name) : controls[name]?.panel === currentPanel).map(([name]) => {
      const control = controls[name], label = control?.label || mcduKeyLabel(name)
      const value = control ? controlValue(name, state) : ''
      return <button key={name} ref={node => { if (node) targets.set(name, node); else targets.delete(name) }} className={`mesh-control ${preset === 'mcdu' ? 'mcdu-key-target' : ''} ${hints ? 'show-hint' : ''} ${control?.step && control.step === highlight ? 'guided-target' : ''}`} aria-label={label} aria-description={value || 'MCDU 实体键'} title={`${label}${value ? ` · ${value}` : ''}${isAdjustable(name) ? ' · 滚轮调整 / Shift + 点击减少' : ''}`} onPointerDown={e => { cameraMotion.current = false; e.stopPropagation(); if (control?.momentary) hold(name) }} onMouseEnter={() => setHover(name)} onMouseLeave={() => setHover('')} onFocus={() => setHover(name)} onBlur={() => { setHover(''); if (held.current === name) release() }} onClick={e => { e.stopPropagation(); if (!controls[name]?.momentary) operate(name, e.shiftKey ? -1 : 1) }} onWheel={e => { if (isAdjustable(name)) { e.stopPropagation(); operate(name, e.deltaY < 0 ? 1 : -1) } }} onKeyUp={e => { if (control?.momentary && [' ', 'Enter'].includes(e.key)) { e.preventDefault(); release() } }} onKeyDown={e => { if (control?.momentary && [' ', 'Enter'].includes(e.key)) { e.preventDefault(); if (!e.repeat) hold(name) } if (isAdjustable(name) && ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); operate(name, ['ArrowUp', 'ArrowRight'].includes(e.key) ? 1 : -1) } }}><span className="sr-only">{label}</span></button>
    })}
    </div>
    {preset === 'mcdu' && <div className="mcdu-context-note"><span>INIT A 快速参考</span><p>ZSPD/ZBAA → 1R<br />AD320 → 3L · 30 → 5L · 350 → 6L</p><small>{AC_POWER(state) ? '先输入，再按对应行选键' : '请先接通交流电源'}</small></div>}
    <div className="camera-presets">{([['overview', '全舱'], ['captain', '机长'], ['overhead', '顶板'], ['main', '主仪表'], ['mcdu', 'MCDU'], ['pedestal', '操纵台']] as const).map(([key, label]) => <button key={key} className={preset === key ? 'active' : ''} onClick={() => switchCamera(key)}>{label}</button>)}<button aria-label="重置驾驶舱视角" onClick={() => setReset(v => v + 1)}><RotateCcw size={14} /></button></div>
    <div className="scene-help"><Move size={13} /><span>{hoverLabel ? `${hoverLabel}${controlValue(hover, state) ? ` · ${controlValue(hover, state)}` : ''}${isAdjustable(hover) ? ' · 滚轮调节，Shift 点击减小' : ''}` : '拖动环顾 · 滚轮缩放 · 右键平移 · 原位点击操作'}</span></div>
    <a className="cockpit-credit" href="https://github.com/legoboyvdlp/A320-family" target="_blank" rel="noreferrer">FlightGear A320-family · GPL-2.0</a>
    <output className="sr-only" aria-label="飞机系统状态">ECAM {ECAM_PAGE(state)} · N2 {state.engineN2.map(n => n.toFixed(1)).join(' / ')} · EGT {state.systems.engineEgt.map(n => n.toFixed(0)).join(' / ')} · FF {fuelFlow(state,0).toFixed(0)} / {fuelFlow(state,1).toFixed(0)} · PACK {PACK_FLOW(state,0) ? 'FLOW' : 'CLOSED'} / {PACK_FLOW(state,1) ? 'FLOW' : 'CLOSED'} · FIRE TEST {state.systems.fireChecked.filter(Boolean).length}/3 · FLAPS {state.systems.actualFlaps.toFixed(1)}</output>
    {preset === 'mcdu' && <output className="sr-only" aria-live="polite">MCDU {mcdu.screen.page} · {mcdu.screen.error || mcdu.screen.scratch} · FROM/TO {state.flightPlan.fromTo} · FLT NBR {state.flightPlan.flightNo} · COST INDEX {state.flightPlan.costIndex} · CRZ FL {state.flightPlan.cruiseLevel}</output>}
  </div>
}
