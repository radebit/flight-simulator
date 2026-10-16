import { Suspense, useMemo, useEffect, useState, Component, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, useProgress } from '@react-three/drei'
import { RotateCcw, Move, Box } from 'lucide-react'
import * as THREE from 'three'
import { initialState, engineN1, type SimState, type Action } from '../sim/engine'
import animationAxes from '../sim/exterior-animations.json'
import { AirportEnvironment, AircraftLights, type TimeOfDay } from './AirportEnvironment'
import { prepareModel, disposeModel } from './modelAssets'
import { AIRFRAME_GROUND_HEIGHT } from './aircraftCoordinates'
import { assetUrl } from '../assetUrl'

class SceneBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? (this.props.fallback ?? <div className="scene-fallback"><Box size={34} /><p>3D 视图暂不可用</p><span>请确认浏览器支持 WebGL，然后刷新重试</span></div>) : this.props.children }
}
export { SceneBoundary }


export function AssetLoading() {
  const { active, progress } = useProgress()
  if (!active) return null
  // Keep loading UI in the main DOM tree. A nested Html root can race with
  // Canvas/Suspense cleanup while changing scenes during a model load.
  return <div className="asset-loading-overlay" role="status"><div className="asset-loading"><span className="asset-spinner" /><strong>正在载入精细模型</strong><small>{Math.round(progress)}% · 几何与原始面板贴图</small></div></div>
}

export function Airplane({ state: s, cockpit = false }: { state: SimState; cockpit?: boolean }) {
  const { scene } = useGLTF(assetUrl('models/a320/exterior.glb'))
  const model = useMemo(() => {
    const model = prepareModel(scene, {
      keep: name => name in animationAxes,
      hide: name => /^(WingtipFence|navglass|navglass.sharklet|FanSpinningLEAPL|FanSpinningLEAPR|Rat|RatSpinner|ULD45|NurbsPath\.004)$/.test(name),
    })
    for (const [name, axis] of Object.entries(animationAxes)) {
      const mesh = model.parts.get(name) as THREE.Mesh | undefined
      if (mesh) { mesh.geometry.translate(-axis.pivot[0], -axis.pivot[1], -axis.pivot[2]); mesh.position.fromArray(axis.pivot); mesh.userData.rotationAxis = new THREE.Vector3(...axis.direction as [number,number,number]); mesh.userData.angle = 0 }
    }
    model.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = !cockpit; object.receiveShadow = !cockpit
      const material = object.material as THREE.MeshStandardMaterial
      // Preserve the outer skin from both sides. Cockpit glass must transmit
      // the outside scene instead of using the exterior's dark display tint.
      material.side = THREE.DoubleSide
      if (cockpit && /glass/i.test(material.name)) { material.opacity = .025; material.depthWrite = false; material.transparent = true }
    })
    return model
  }, [scene, cockpit])
  useEffect(() => () => disposeModel(model.root), [model])
  useFrame((_, dt) => {
    for (const [name, axis] of Object.entries(animationAxes)) {
      const object = model.parts.get(name)
      if (!object) continue
      if (name.startsWith('Fan')) object.userData.angle += Math.min(dt,.1) * engineN1(s, name.endsWith('L') ? 0 : 1) * .7
      else object.userData.angle = THREE.MathUtils.lerp(object.userData.angle, THREE.MathUtils.degToRad(axis.factor * (name === 'ApuFlap' ? s.systems.apuFlap : s.systems.actualFlaps / 4)), 1 - Math.exp(-8 * dt))
      object.quaternion.setFromAxisAngle(object.userData.rotationAxis, object.userData.angle)
    }
  })
  return <primitive object={model.root} position={[0, AIRFRAME_GROUND_HEIGHT, 0]} />
}
const exteriorCameras = {
  ramp: { label: '停机坪', position: [-43, 18, 38] as [number,number,number], target: [-1,4,0] as [number,number,number] },
  nose: { label: '机头', position: [-49, 7, 10] as [number,number,number], target: [-6,4,0] as [number,number,number] },
  wing: { label: '左翼 / 发动机', position: [-14, 6, 27] as [number,number,number], target: [-4,3,6] as [number,number,number] },
  tail: { label: '机尾', position: [41, 16, -32] as [number,number,number], target: [1,6,0] as [number,number,number] },
}
export default function AircraftScene({ state, session = false, time = 'day', onTime, dispatch }: { state?: SimState; session?: boolean; time?: TimeOfDay; onTime?: (time: TimeOfDay) => void; dispatch?: (action: Action) => void }) {
  const [reset, setReset] = useState(0)
  const [camera, setCamera] = useState<keyof typeof exteriorCameras>('ramp')
  const cold = useMemo(() => initialState(), [])
  const s = state || cold, preset = exteriorCameras[camera]
  return <div className={`aircraft-scene ${session ? 'exterior-session' : 'hangar-exterior'}`}>
    <SceneBoundary><Canvas key={`${reset}-${camera}`} shadows="percentage" dpr={[1, 1.6]} camera={{ position: preset.position, fov: session ? 47 : 42, near: .5, far: 8000 }} gl={{ antialias: true, logarithmicDepthBuffer: true }}>
      <AirportEnvironment state={s} time={time} />
      <Suspense fallback={null}><Airplane state={s} /></Suspense>
      <AircraftLights state={s} time={time} />
      <OrbitControls makeDefault target={preset.target} enablePan={session} minDistance={5} maxDistance={250} minPolarAngle={.12} maxPolarAngle={Math.PI / 2 - .015} />
    </Canvas><AssetLoading /></SceneBoundary>
    {session ? <>
      <div className="exterior-heading"><span className="eyebrow">A320 · EXTERIOR</span><h2>停机位 A12</h2><p>训练机场 · 与驾驶舱同步</p></div>
      <div className="exterior-weather" aria-label="机场光照">{(['day','sunset','night'] as const).map(t=><button key={t} className={time===t?'active':''} aria-pressed={time===t} onClick={()=>onTime?.(t)}>{({day:'日间',sunset:'黄昏',night:'夜间'})[t]}</button>)}</div>
      <div className="ground-services"><span>地勤服务</span><button aria-pressed={s.systems.groundPowerConnected} onClick={()=>dispatch?.({type:'groundPower'})}>GPU {s.systems.groundPowerConnected?'已连接 · 撤离':'已撤离 · 接入'}</button><button aria-pressed={s.systems.chocks} onClick={()=>dispatch?.({type:'chocks'})}>轮挡 {s.systems.chocks?'已放置 · 移除':'已移除 · 放置'}</button></div>
      <div className="camera-presets exterior-cameras">{Object.entries(exteriorCameras).map(([key,p])=><button key={key} className={key===camera?'active':''} onClick={()=>setCamera(key as keyof typeof exteriorCameras)}>{p.label}</button>)}<button aria-label="重置外景视角" onClick={()=>setReset(v=>v+1)}><RotateCcw size={14}/></button></div>
    </> : <div className="model-caption"><span className="small-cross">+</span> A320neo <span className="muted">/</span> LEAP-1A</div>}
    <div className="model-hint"><Move size={13} /> 拖动旋转 · 滚轮缩放 {!session&&<button className="icon-button" aria-label="重置机型视角" title="重置视角" onClick={() => setReset(v => v + 1)}><RotateCcw size={15} /></button>}</div>
    <a className="model-credit" href="https://github.com/legoboyvdlp/A320-family" target="_blank" rel="noreferrer">FlightGear A320-family · GPL-2.0</a>
  </div>
}
