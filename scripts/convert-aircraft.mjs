/**
 * Convert the pinned GPL-2.0 FlightGear A320 assets to glTF 2.0.
 * Geometry, UVs, names, and original physical coordinates are retained.
 * No source executable code is run. See THIRD_PARTY_NOTICES.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3, Quaternion } from 'three'
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'

const sourceRoot = 'vendor/flightgear-a320'
const output = 'public/models/a320'
fs.mkdirSync(output, { recursive: true })

function readAC(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)
  let cursor = 1
  const materials = []
  while (lines[cursor]?.startsWith('MATERIAL ')) {
    const line = lines[cursor++]
    const values = name => line.match(new RegExp(` ${name} ([\\d.eE+\\- ]+)`))?.[1].trim().split(/\s+/).map(Number)
    materials.push({ name: line.match(/^MATERIAL "(.*?)"/)[1], rgb: values('rgb'), emission: values('emis'), transparency: values('trans')[0] })
  }
  function object() {
    while (lines[cursor] === '') cursor++
    if (!lines[cursor]?.startsWith('OBJECT ')) throw Error(`${file}:${cursor + 1} expected OBJECT`)
    const type = lines[cursor++].slice(7)
    const o = { type, name: '', vertices: [], surfaces: [], children: [], matrix: new Matrix4(), location: [0, 0, 0], rotation: null, crease: 45, texture: null, texrep: [1, 1], texoff: [0, 0], file, materials }
    while (cursor < lines.length) {
      const line = lines[cursor++]
      const space = line.indexOf(' '), key = space < 0 ? line : line.slice(0, space), val = line.slice(space + 1)
      const numbers = () => val.trim().split(/\s+/).map(Number)
      if (key === 'name') o.name = val.replace(/^"|"$/g, '')
      else if (key === 'texture') o.texture = val.replace(/^"|"$/g, '')
      else if (key === 'crease') o.crease = +val
      else if (key === 'loc') o.location = numbers()
      else if (key === 'rot') o.rotation = numbers()
      else if (key === 'texrep') o.texrep = numbers()
      else if (key === 'texoff') o.texoff = numbers()
      else if (key === 'data') { let bytes = 0; while (bytes < +val) bytes += Buffer.byteLength(lines[cursor++]) + 1 }
      else if (key === 'numvert') for (let i = 0; i < +val; i++) o.vertices.push(lines[cursor++].trim().split(/\s+/).map(Number))
      else if (key === 'numsurf') for (let i = 0; i < +val; i++) {
        let flags = 0, material = 0, refs = []
        while (cursor < lines.length) {
          const s = lines[cursor++].trim().split(/\s+/)
          if (s[0] === 'SURF') flags = parseInt(s[1])
          else if (s[0] === 'mat') material = +s[1]
          else if (s[0] === 'refs') { for (let j = 0; j < +s[1]; j++) refs.push(lines[cursor++].trim().split(/\s+/).map(Number)); break }
        }
        o.surfaces.push({ flags, material, refs })
      }
      else if (key === 'kids') {
        for (let i = 0; i < +val; i++) o.children.push(object())
        if (o.rotation) {
          const r = o.rotation
          o.matrix.set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1)
        }
        o.matrix.setPosition(...o.location)
        return o
      }
    }
    throw Error(`Unterminated object ${o.name}`)
  }
  return object()
}

function convert(label, sources) {
  const gltf = { asset: { version: '2.0', generator: 'AeroDeck AC3D converter', copyright: 'FlightGear A320-family contributors, GPL-2.0; see THIRD_PARTY_NOTICES.md' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], textures: [], images: [], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }], accessors: [], bufferViews: [], buffers: [] }
  const chunks = [], textureCache = new Map(), materialCache = new Map(), manifest = [], axes = {}
  let offset = 0, triangleCount = 0
  function bufferView(data, target) {
    const buffer = Buffer.from(data.buffer ?? data, data.byteOffset ?? 0, data.byteLength ?? data.length)
    const padding = (4 - offset % 4) % 4
    if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding }
    const index = gltf.bufferViews.length
    gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buffer.length, ...(target ? { target } : {}) })
    chunks.push(buffer); offset += buffer.length
    return index
  }
  function attribute(data, size, target = 34962, bounds = false) {
    const accessor = { bufferView: bufferView(data, target), componentType: data instanceof Float32Array ? 5126 : 5125, count: data.length / size, type: size === 1 ? 'SCALAR' : `VEC${size}` }
    if (bounds) {
      accessor.min = Array(size).fill(Infinity); accessor.max = Array(size).fill(-Infinity)
      for (let i = 0; i < data.length; i++) { accessor.min[i % size] = Math.min(accessor.min[i % size], data[i]); accessor.max[i % size] = Math.max(accessor.max[i % size], data[i]) }
    }
    gltf.accessors.push(accessor); return gltf.accessors.length - 1
  }
  function texture(o) {
    if (label === 'exterior' && o.texture === 'Fuse-Main.png') o = { ...o, file: path.join(sourceRoot, 'Models/Liveries/CFM-NEO/4k/asset.ac'), texture: 'SAS-fuselage.png' }
    if (label === 'exterior' && o.texture === 'engine-leap1a.png') o = { ...o, file: path.join(sourceRoot, 'Models/Liveries/CFM-NEO/2k/asset.ac'), texture: 'SAS-engine.png' }
    if (!o.texture) return undefined
    let file = path.resolve(path.dirname(o.file), o.texture)
    if (!fs.existsSync(file)) file = path.resolve(sourceRoot, 'Models/FlightDeck/res', o.texture)
    if (textureCache.has(file)) return textureCache.get(file)
    const index = gltf.textures.length
    gltf.images.push({ name: o.texture, bufferView: bufferView(fs.readFileSync(file)), mimeType: file.endsWith('.jpg') ? 'image/jpeg' : 'image/png' })
    gltf.textures.push({ sampler: 0, source: gltf.images.length - 1 })
    textureCache.set(file, index)
    return index
  }
  function material(o, i, doubleSided) {
    const source = o.materials[i]
    const tex = texture(o)
    const key = JSON.stringify([source.name, tex, doubleSided])
    if (materialCache.has(key)) return materialCache.get(key)
    let alpha = 1 - source.transparency
    const glass = /glass|visor/i.test(source.name)
    if (glass && alpha < .02) alpha = label === 'exterior' ? .82 : .035
    const m = { name: `${source.name}/${o.texture || 'solid'}`, pbrMetallicRoughness: { baseColorFactor: [...source.rgb, alpha], metallicFactor: label === 'exterior' ? .15 : .02, roughnessFactor: glass ? .12 : label === 'exterior' ? .4 : .77, ...(tex !== undefined ? { baseColorTexture: { index: tex } } : {}) }, doubleSided, ...(alpha < 1 ? { alphaMode: 'BLEND' } : tex !== undefined ? { alphaMode: 'MASK', alphaCutoff: .25 } : {}) }
    if (glass && label === 'exterior') m.pbrMetallicRoughness.baseColorFactor = [.06, .10, .13, .94]
    gltf.materials.push(m); materialCache.set(key, gltf.materials.length - 1)
    return gltf.materials.length - 1
  }
  function walk(o, parentMatrix) {
    const matrix = parentMatrix.clone().multiply(o.matrix)
    if (o.vertices.length && /\.axis/.test(o.name)) {
      const a = new Vector3(...o.vertices[0]).applyMatrix4(matrix), b = new Vector3(...o.vertices[o.vertices.length - 1]).applyMatrix4(matrix)
      axes[o.name] = { pivot: a.toArray(), direction: b.sub(a).normalize().toArray() }
    }
    if (o.vertices.length) {
      const byMaterial = new Map()
      for (const surf of o.surfaces) {
        if ((surf.flags & 0xf) !== 0 || surf.refs.length < 3) continue
        const key = `${surf.material}/${Boolean(surf.flags & 0x20)}`
        if (!byMaterial.has(key)) byMaterial.set(key, { material: surf.material, doubleSided: !!(surf.flags & 0x20), position: [], uv: [] })
        const group = byMaterial.get(key)
        for (let j = 1; j < surf.refs.length - 1; j++) for (const ref of [surf.refs[0], surf.refs[j], surf.refs[j + 1]]) {
          group.position.push(...o.vertices[ref[0]])
          group.uv.push(ref[1] * o.texrep[0] + o.texoff[0], 1 - (ref[2] * o.texrep[1] + o.texoff[1]))
        }
      }
      const primitives = [], bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
      for (const group of byMaterial.values()) {
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new Float32BufferAttribute(group.position, 3))
        geometry.setAttribute('uv', new Float32BufferAttribute(group.uv, 2))
        geometry.applyMatrix4(matrix)
        const smooth = mergeVertices(toCreasedNormals(geometry, o.crease * Math.PI / 180), .000001)
        smooth.computeBoundingBox()
        for (let j = 0; j < 3; j++) { bounds.min[j] = Math.min(bounds.min[j], smooth.boundingBox.min.getComponent(j)); bounds.max[j] = Math.max(bounds.max[j], smooth.boundingBox.max.getComponent(j)) }
        triangleCount += smooth.index.count / 3
        primitives.push({ attributes: { POSITION: attribute(smooth.attributes.position.array, 3, 34962, true), NORMAL: attribute(smooth.attributes.normal.array, 3), TEXCOORD_0: attribute(smooth.attributes.uv.array, 2) }, indices: attribute(new Uint32Array(smooth.index.array), 1, 34963), material: material(o, group.material, group.doubleSided) })
      }
      if (primitives.length) {
        const index = gltf.nodes.length
        gltf.meshes.push({ name: o.name, primitives })
        gltf.nodes.push({ name: o.name, mesh: gltf.meshes.length - 1, extras: { sourceName: o.name } })
        gltf.scenes[0].nodes.push(index)
        manifest.push({ name: o.name, ...bounds })
      }
    }
    for (const child of o.children) walk(child, matrix)
  }
  for (const { file, translation = [0, 0, 0] } of sources) walk(readAC(path.join(sourceRoot, file)), new Matrix4().makeTranslation(...translation))
  const pad = (4 - offset % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad }
  gltf.buffers.push({ byteLength: offset })
  const json = Buffer.from(JSON.stringify(gltf)), jsonPad = (4 - json.length % 4) % 4
  const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPad, 32)])
  const binary = Buffer.concat(chunks)
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binary.length, 8); header.writeUInt32LE(jsonChunk.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4)
  fs.writeFileSync(`${output}/${label}.glb`, Buffer.concat([header, jsonChunk, binHeader, binary]))
  fs.writeFileSync(`${output}/${label}-manifest.json`, JSON.stringify({ sourceRevision: fs.readFileSync(`${sourceRoot}/REVISION`, 'utf8').trim(), triangles: triangleCount, axes, parts: manifest }, null, 2))
  console.log(`${label}: ${gltf.meshes.length} meshes, ${triangleCount.toLocaleString()} triangles, ${gltf.textures.length} textures, ${(fs.statSync(`${output}/${label}.glb`).size / 1048576).toFixed(1)} MiB`)
}

// Both A320-common and EnginesCFMLEAP have the same parent z offset (0.83109).
// It cancels in the airframe-local frame; applying it only to the engines lifts
// their pylons through the wing.
convert('exterior', [{ file: 'Models/Fuselage/res/A320-216.ac' }, { file: 'Models/Fuselage/res/CFMLEAP1A.ac' }])
convert('cockpit', [{ file: 'Models/FlightDeck/res/fd_complete.ac' }, ...['PFD/res/PFD1.ac', 'PFD/res/PFD2.ac', 'ND/res/ND.ac', 'ND/res/ND_R.ac', 'Upper-ECAM/res/Upper-ECAM.ac', 'Lower-ECAM/res/Lower-ECAM.ac'].map(file => ({ file: `Models/Instruments/${file}` }))])
