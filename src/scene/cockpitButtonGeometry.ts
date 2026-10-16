import * as THREE from 'three'
import { controls, controlLayout } from './cockpitControls'
import { hasUnlitLegend } from './cockpitLamps'

// The source's baked panel includes raised button caps up to 0.65 mm above
// the separate animated buttons. Lift each complete button assembly along its
// own face normal, retaining the original footprint and the source 0.75 mm travel.
export const BUTTON_FACE_CLEARANCE = .0015
export const BUTTON_PRESS_TRAVEL = .00075

export function separateOverheadButtonFaces(parts: Map<string, THREE.Object3D>) {
  const normals = new Map<string, THREE.Vector3>()
  for (const [name, object] of parts) {
    if (!hasUnlitLegend(name) || !(object instanceof THREE.Mesh)) continue
    const parent = name.replace(/[12][A-Z]$/, '')
    if (controls[parent]?.panel !== 'overhead' && (controlLayout[parent]?.center[1] ?? 0) < .8) continue
    const normal = object.geometry.getAttribute('normal')
    if (normal) normals.set(parent, new THREE.Vector3().fromBufferAttribute(normal, 0).normalize())
  }
  for (const [name, object] of parts) {
    if (!(object instanceof THREE.Mesh)) continue
    const parent = hasUnlitLegend(name) ? name.replace(/[12][A-Z]$/, '') : name
    const normal = normals.get(parent)
    if (!normal) continue
    object.geometry.translate(normal.x * BUTTON_FACE_CLEARANCE, normal.y * BUTTON_FACE_CLEARANCE, normal.z * BUTTON_FACE_CLEARANCE)
  }
}
