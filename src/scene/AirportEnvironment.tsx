import { useEffect, useMemo, useRef, type Ref } from 'react'
import { Sky } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SimState } from '../sim/engine'
import { AIRPORT_IN_COCKPIT } from './aircraftCoordinates'
export type TimeOfDay = 'day' | 'sunset' | 'night'
const palettes = {
  day: { sky: '#b4c8d5', sun: '#fff4dc', ambient: .8, direct: 3.1, position: [-90, 140, 75] as [number, number, number] },
  sunset: { sky: '#b3a5a3', sun: '#ffd2a0', ambient: .55, direct: 2.5, position: [-120, 18, -70] as [number, number, number] },
  night: { sky: '#111c31', sun: '#94b4e3', ambient: .16, direct: .32, position: [-90, 140, 75] as [number, number, number] },
}

function pavementTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#969892'; g.fillRect(0, 0, 512, 512)
  let seed = 1203
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  for (let i = 0; i < 28000; i++) { const n = Math.floor(random() * 38 + 115); g.fillStyle = `rgba(${n},${n},${n-3},.15)`; g.fillRect(random()*512, random()*512, 1.3, 1.3) }
  g.strokeStyle = '#686d6888'; g.lineWidth = 2; g.strokeRect(0, 0, 512, 512)
  g.strokeStyle = '#c1c2b768'; g.lineWidth = 1; g.strokeRect(3, 3, 506, 506)
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(22, 32); texture.anisotropy = 8
  return texture
}
function Box({ p, s, color = '#d0d1cc', metal = 0, roughness = .7 }: { p: [number, number, number]; s: [number, number, number]; color?: string; metal?: number; roughness?: number }) {
  return <mesh position={p} castShadow receiveShadow><boxGeometry args={s} /><meshStandardMaterial color={color} metalness={metal} roughness={roughness} /></mesh>
}
function RepeatedBoxes({ positions, size, color, emissive = false }: { positions: [number, number, number][]; size: [number, number, number]; color: string; emissive?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => { positions.forEach((p, i) => ref.current?.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...p))); if (ref.current) ref.current.instanceMatrix.needsUpdate = true }, [positions])
  return <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} castShadow={!emissive} receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} emissive={emissive ? color : '#000000'} emissiveIntensity={emissive ? 2 : 0} roughness={.6} metalness={.15} /></instancedMesh>
}
function Sign({ text, p, width = 3, ground = false, color = '#f7d65e', background = '#283437', facing = Math.PI / 2 }: { text: string; p: [number, number, number]; width?: number; ground?: boolean; color?: string; background?: string; facing?: number }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 192
    const g = c.getContext('2d')!; g.fillStyle = background; g.fillRect(0, 0, 512, 192)
    g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(8, 8, 496, 176)
    g.font = 'bold 100px Arial'; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 101, 466)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
  }, [text, color, background])
  useEffect(() => () => texture.dispose(), [texture])
  return <group position={p} rotation={ground ? [-Math.PI / 2, 0, -Math.PI / 2] : [0, facing, 0]}>
    {(ground ? [0] : [0, Math.PI]).map(angle => <mesh key={angle} rotation={[0, angle, 0]} position={[0, 0, angle ? -.005 : .005]}><planeGeometry args={[width, width * .375]} /><meshStandardMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={ground ? 0 : .15} roughness={.8} /></mesh>)}
  </group>
}
function Wheels({ x, z, y = .34 }: { x: number; z: number; y?: number }) {
  return <>{[-1, 1].flatMap(a => [-1, 1].map(b => <mesh key={`${a}${b}`} position={[x*a,y,z*b]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.32,.32,.22,16]} /><meshStandardMaterial color="#242a2a" roughness={.9} /></mesh>))}</>
}
function GroundPower({ connected }: { connected: boolean }) {
  return <group position={[-20, 0, connected ? -6.5 : -30]}>
    <Wheels x={1.15} z={.73} />
    <Box p={[0, .9, 0]} s={[3.3, 1.15, 1.6]} color="#dfdfd5" />
    <Box p={[0, 1.5, 0]} s={[3.4, .12, 1.7]} color="#e4ac36" />
    <Box p={[-1.7, .65, 0]} s={[1, .12, .18]} color="#444b4c" metal={.7} />
    <RepeatedBoxes positions={Array.from({length:10},(_,i)=>[i*.2-.8,1,-.81])} size={[.06,.55,.02]} color="#3a4648" />
    <Sign text="GPU" p={[.9, 1, -.82]} width={.9} facing={Math.PI} />
    {connected && <mesh position={[2.3, .07, 1.8]} rotation={[Math.PI / 2, 0, -.45]}><torusGeometry args={[2.3,.045,6,40,2.3]} /><meshStandardMaterial color="#242629" /></mesh>}
  </group>
}
function Tug({ position }: { position: [number, number, number] }) {
  return <group position={position}>
    <Wheels x={1.7} z={1.15} y={.45} />
    <Box p={[0,.8,0]} s={[4.9,.9,2.5]} color="#e4ddc8" />
    <Box p={[.55,1.55,0]} s={[1.6,.8,2]} color="#364a53" metal={.35} roughness={.23} />
    <Box p={[.55,2,0]} s={[1.9,.14,2.3]} color="#e0ddcd" />
    <Box p={[-2.42,.8,0]} s={[.06,.3,2.3]} color="#282d30" />
    <Box p={[.55,2.15,0]} s={[.35,.2,.3]} color="#ea962f" />
    <Sign text="TUG 04" p={[-.6,1.05,1.26]} width={1.3} facing={0} />
  </group>
}
function Cone({ position }: { position: [number, number, number] }) {
  return <group position={position}><Box p={[0,.04,0]} s={[.46,.08,.46]} color="#303332" /><mesh position={[0,.35,0]} castShadow><coneGeometry args={[.2,.65,16]} /><meshStandardMaterial color="#e66c24" /></mesh><mesh position={[0,.43,0]}><cylinderGeometry args={[.065,.105,.14,16]} /><meshStandardMaterial color="#ece8d5" /></mesh></group>
}
function Jetway({ z, gate }: { z: number; gate: string }) {
  return <group position={[0,0,z]}>
    <Box p={[-39,4.4,6]} s={[25,2.8,3.3]} color="#c9d0cf" metal={.3} />
    <Box p={[-39,4.5,7.67]} s={[23,1.7,.05]} color="#46626c" metal={.55} roughness={.18} />
    <RepeatedBoxes positions={Array.from({length:12},(_,i)=>[-50+i*2,4.5,7.73])} size={[.08,2,.1]} color="#e0e3db" />
    <Box p={[-27,2.1,6]} s={[.6,4.2,.6]} color="#6f7c7e" metal={.4} />
    <group position={[-24,4.4,4]} rotation={[0,-.6,0]}><Box p={[0,0,0]} s={[6,2.9,3.4]} color="#a6b2b4" /><Box p={[3,0,0]} s={[.8,3,3.6]} color="#424c4e" /><RepeatedBoxes positions={Array.from({length:7},(_,i)=>[2.75+i*.1,0,0])} size={[.035,3.1,3.65]} color="#283336" /></group>
    <Sign text={gate} p={[-26,6.7,6]} width={3} />
  </group>
}
function Terminal({ night }: { night: boolean }) {
  return <group>
    <Box p={[-66,6.4,0]} s={[27,12.8,210]} color="#bbbdb5" />
    <Box p={[-52.42,7.8,0]} s={[.12,8.6,205]} color={night ? '#a39669' : '#41616f'} metal={.65} roughness={.22} />
    <RepeatedBoxes positions={Array.from({length:52},(_,i)=>[-52.15,7.6,i*4-102])} size={[.28,9.5,.13]} color="#aebdbf" />
    <RepeatedBoxes positions={[[-52.05,4.3,0],[-52.05,7,0],[-52.05,9.8,0]]} size={[.28,.18,205]} color="#b7c6c8" />
    <Box p={[-64,13.3,0]} s={[34,.7,216]} color="#d9ded6" metal={.35} />
    <RepeatedBoxes positions={Array.from({length:27},(_,i)=>[-64,13.8,i*8-104])} size={[35,.15,.35]} color="#a2afb2" />
    <RepeatedBoxes positions={Array.from({length:15},(_,i)=>[-51.9,3.1,i*14-98])} size={[.12,.12,6]} color="#f5dfb0" emissive={night} />
    <Sign text="FLIGHT SIMULATOR  T1" p={[-52,11.3,0]} width={18} color="#f0f2df" background="#274149" />
    <Jetway z={22} gate="A12" /><Jetway z={-55} gate="A10" /><Jetway z={90} gate="A14" />
  </group>
}
function ApronLights({ night }: { night: boolean }) {
  return <>{[-85,75].flatMap(z=>[-35,70].map(x=><group key={`${x}${z}`} position={[x,0,z]}>
    <Box p={[0,11,0]} s={[.28,22,.28]} color="#7e8b90" metal={.5} />
    <Box p={[0,22,0]} s={[4,.4,1]} color="#4b575d" />
    <RepeatedBoxes positions={[-1.5,-.5,.5,1.5].map(a=>[a,21.75,0])} size={[.7,.12,.7]} color="#f5e8bc" emissive={night} />
    {night && <pointLight position={[0,20,0]} intensity={900} distance={80} decay={2} color="#ffe7b7" />}
  </group>))}</>
}

/** A handcrafted generic training airport. All coordinates use the aircraft's metric ground frame. */
export function AirportEnvironment({ state, time = 'day', cockpit = false }: { state?: SimState; time?: TimeOfDay; cockpit?: boolean }) {
  const palette = palettes[time], night = time === 'night'
  const concrete = useMemo(pavementTexture, [])
  useEffect(() => () => concrete.dispose(), [concrete])
  return <>
    <color attach="background" args={[palette.sky]} /><fog attach="fog" args={[palette.sky, 180, night ? 1600 : 2800]} />
    {time !== 'night' && <Sky distance={45000} sunPosition={palette.position} turbidity={4.5} rayleigh={1.25} mieCoefficient={.006} mieDirectionalG={.8} />}
    <ambientLight intensity={palette.ambient} color={night ? '#8aa1c5' : '#eff5fa'} />
    <hemisphereLight args={[night ? '#8295bc' : '#d9ebf8', '#6c6a55', palette.ambient]} />
    <directionalLight position={palette.position} intensity={palette.direct} color={palette.sun} castShadow={!cockpit} shadow-mapSize={[2048,2048]} shadow-camera-left={-55} shadow-camera-right={55} shadow-camera-top={55} shadow-camera-bottom={-55} shadow-camera-near={1} shadow-camera-far={350} shadow-bias={-.0003} shadow-normalBias={.06} />
    <group position={cockpit ? AIRPORT_IN_COCKPIT : [0,0,0]}>
      {/* Adjacent surfaces share edges, never overlapping coplanar ground layers. */}
      {[
        [-3000,-110,-3000,3000], [-110,98,-3000,-160], [-110,98,160,3000],
        [98,126,-3000,-900], [98,126,900,3000], [126,232.5,-3000,3000],
        [232.5,277.5,-3000,-1300], [232.5,277.5,1300,3000], [277.5,3000,-3000,3000],
      ].map(([x0,x1,z0,z1],i)=><mesh key={i} rotation={[-Math.PI/2,0,0]} position={[(x0+x1)/2,0,(z0+z1)/2]} receiveShadow><planeGeometry args={[x1-x0,z1-z0]} /><meshStandardMaterial color={night ? '#27312a' : '#6f7b51'} roughness={1} /></mesh>)}
      <mesh position={[-6,0,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[208,320]} /><meshStandardMaterial map={concrete} roughness={.95} /></mesh>
      <Box p={[112,.008,0]} s={[28,.015,1800]} color="#565d5b" />
      <Box p={[255,.009,0]} s={[45,.018,2600]} color="#4b5353" />
      <RepeatedBoxes positions={Array.from({length:60},(_,i)=>[255,.027,i*40-1200])} size={[.6,.01,21]} color="#dbded3" />
      <RepeatedBoxes positions={Array.from({length:120},(_,i)=>[112,.025,i*14-850])} size={[.14,.02,8]} color="#d3b54f" />
      <RepeatedBoxes positions={Array.from({length:100},(_,i)=>[96,.12,i*17-850])} size={[.13,.18,.13]} color="#4979ee" emissive={night} />
      <RepeatedBoxes positions={Array.from({length:110},(_,i)=>[230,.12,i*21-1100])} size={[.15,.18,.15]} color="#f1e7bd" emissive={night} />
      <RepeatedBoxes positions={[-75,0,75].map(z=>[8,.023,z])} size={[84,.01,.17]} color="#e3bd48" />
      <RepeatedBoxes positions={[-75,0,75].map(z=>[-14.8,.024,z])} size={[.18,.01,3.6]} color="#ecd168" />
      <RepeatedBoxes positions={[-75,0,75].flatMap(z=>[1,-1].map(i=>[2,.022,z+23*i]))} size={[64,.01,.16]} color="#b65548" />
      <Sign text="A12" p={[-28,.025,0]} ground width={6} background="#b3a46d" color="#444a42" />
      <Sign text="A10" p={[-28,.025,-75]} ground width={6} background="#b3a46d" color="#444a42" />
      <Sign text="A14" p={[-28,.025,75]} ground width={6} background="#b3a46d" color="#444a42" />
      <Sign text="A  →" p={[91,.65,-34]} width={3} facing={-Math.PI/2} /><Sign text="16L–34R" p={[203,.6,68]} width={5} background="#8e3e37" color="#fff3df" facing={-Math.PI/2} />
      <Terminal night={night} /><ApronLights night={night} />
      <GroundPower connected={state?.systems.groundPowerConnected ?? true} />
      <Tug position={[-31,0,-13]} />
      {[[-22,0,4],[-23,0,-4],[2,0,20],[2,0,-20]].map((p,i)=><Cone key={i} position={p as [number,number,number]} />)}
      <group position={[-34,0,37]}>
        {[0,1,2].map(i=><group key={i} position={[i*3.7,0,0]}><Wheels x={1.15} z={.7} /><Box p={[0,.7,0]} s={[3,.6,1.7]} color="#9ea7a0" /><Box p={[0,1.35,0]} s={[2.7,.7,1.5]} color={i===1?'#6a777e':'#c7c6b5'} /></group>)}
      </group>
      <group position={[55,0,280]}><Box p={[0,25,0]} s={[9,50,9]} color="#a8afaa" /><Box p={[0,50,0]} s={[20,7,20]} color="#3d555f" metal={.5} /><Box p={[0,54,0]} s={[23,1,23]} color="#d4d6cb" /><Box p={[0,60,0]} s={[.3,12,.3]} color="#c5cbc5" /></group>
      {[-400,-250,370,530].map((z,i)=><group key={z}><Box p={[-140,10,z]} s={[70,20,90]} color={i%2?'#959f9f':'#b2b7b0'} /><Box p={[-103,8,z]} s={[.1,15,60]} color="#64787f" /></group>)}
      {state?.systems.chocks && [-1,1].flatMap(z=>[-.7,.7].map(x=><Box key={`${x}${z}`} p={[-.4+x,.12,3.8*z]} s={[.26,.24,.6]} color="#b8a241" />))}
    </group>
  </>
}

export function AircraftLights({ state: s, time }: { state: SimState; time: TimeOfDay }) {
  const beacon = useRef<THREE.Mesh>(null), strobeL = useRef<THREE.Mesh>(null), strobeR = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (beacon.current) beacon.current.visible = DCpowered(s) && s.beacon && t % 1.2 < .13
    const flash = ACpowered(s) && s.systems.strobe === 'ON' && (t % 1 < .07 || t % 1 > .16 && t % 1 < .23)
    if (strobeL.current) strobeL.current.visible = flash
    if (strobeR.current) strobeR.current.visible = flash
  })
  const bulb = (p: [number,number,number], color: string, visible: boolean, ref?: Ref<THREE.Mesh>) => <mesh key={p.join()} ref={ref} position={p} visible={visible}><sphereGeometry args={[.1,10,8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
  return <>
    {bulb([-3.77,6.39,0], '#ff3526', false, beacon)}
    {bulb([1.54,4.69,16.37], '#ff2118', DCpowered(s)&&s.navLights)}
    {bulb([1.54,4.69,-16.37], '#42ff7c', DCpowered(s)&&s.navLights)}
    {bulb([18,5.1,0], '#fff8dc', DCpowered(s)&&s.navLights)}
    {bulb([2.33,5.06,17.1], '#ffffff', false, strobeL)}{bulb([2.33,5.06,-17.1], '#ffffff', false, strobeR)}
    {s.systems.landing.map((on,i)=>on&&ACpowered(s)&&<LandingBeam key={i} position={[-1.97,2.88,i? -2.235:2.235]} night={time==='night'} />)}
    {s.systems.nose !== 'OFF' && ACpowered(s) && <LandingBeam position={[-13.7,1.1,0]} night={time==='night'} taxi={s.systems.nose==='TAXI'} />}
    {s.systems.turnoff && ACpowered(s) && <><LandingBeam position={[-13.7,1.2,.3]} night={time==='night'} taxi spread={28} /><LandingBeam position={[-13.7,1.2,-.3]} night={time==='night'} taxi spread={-28} /></>}
    {s.systems.wingLight && ACpowered(s) && [-1,1].map(side => <SurfaceBeam key={`wing${side}`} position={[-9,4.8,side*1.7]} target={[1,4.6,side*10]} night={time==='night'} />)}
    {s.navLights && ACpowered(s) && [-1,1].map(side => <SurfaceBeam key={`logo${side}`} position={[14,5.4,side*3]} target={[16.4,9.4,0]} night={time==='night'} />)}
  </>
}
import { AC_POWER as ACpowered, DC_POWER as DCpowered } from '../sim/engine'
function LandingBeam({ position, night, taxi = false, spread = 0 }: { position: [number,number,number]; night: boolean; taxi?: boolean; spread?: number }) {
  const target = useMemo(()=>{const t=new THREE.Object3D();t.position.set(position[0]-50,0,position[2]+spread);return t},[position[0],position[2],spread])
  return <><primitive object={target} /><spotLight position={position} target={target} color="#fff3d6" intensity={night?taxi?700:1800:40} distance={100} angle={taxi ? .32 : .2} penumbra={.6} /><mesh position={position}><sphereGeometry args={[.09,8,8]} /><meshBasicMaterial color="#fff6dd" toneMapped={false} /></mesh></>
}

function SurfaceBeam({ position, target: point, night }: { position: [number,number,number]; target: [number,number,number]; night: boolean }) {
  const target = useMemo(() => { const object = new THREE.Object3D(); object.position.fromArray(point); return object }, [point[0], point[1], point[2]])
  return <><primitive object={target} /><spotLight position={position} target={target} color="#fff2d7" intensity={night ? 95 : 5} distance={23} angle={.65} penumbra={.55} decay={2} /></>
}
