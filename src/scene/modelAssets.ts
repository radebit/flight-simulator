import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Batch static surfaces without moving a single vertex or changing the source layout. */
export function prepareModel(source: THREE.Group, options: { keep?: (name: string) => boolean; hide?: (name: string) => boolean } = {}) {
  const root = new THREE.Group()
  const parts = new Map<string, THREE.Object3D>()
  const batches = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>()
  source.updateMatrixWorld(true)
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    const name = object.userData.sourceName || object.parent?.userData.sourceName || object.name
    if (options.hide?.(name)) return
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld)
    const material = (Array.isArray(object.material) ? object.material[0] : object.material).clone()
    if (material instanceof THREE.MeshStandardMaterial) {
      if (material.map) { material.map.anisotropy = 8 }
      material.envMapIntensity = .5
    }
    if (options.keep?.(name)) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = name; mesh.userData.sourceName = name
      mesh.castShadow = false; mesh.receiveShadow = false
      root.add(mesh); parts.set(name, mesh)
    } else {
      const originalMaterial = Array.isArray(object.material) ? object.material[0] : object.material
      const key = originalMaterial.uuid
      if (!batches.has(key)) batches.set(key, { material, geometries: [] })
      else material.dispose()
      batches.get(key)!.geometries.push(geometry)
    }
  })
  for (const { material, geometries } of batches.values()) {
    const merged = mergeGeometries(geometries)
    if (merged) { const mesh = new THREE.Mesh(merged, material); mesh.name = 'static-surfaces'; mesh.receiveShadow = true; root.add(mesh) }
    geometries.forEach(g => g.dispose())
  }
  return { root, parts }
}

export function disposeModel(root: THREE.Group) {
  root.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose()) } })
}
