import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const output = 'public/models/a320'
fs.mkdirSync(output, { recursive: true })
fs.copyFileSync('vendor/flightgear-a320/LICENSE', `${output}/LICENSE.txt`)
fs.copyFileSync('THIRD_PARTY_NOTICES.md', `${output}/NOTICE.txt`)
execFileSync('tar', ['-czf', `${output}/flightgear-source.tar.gz`, 'vendor/flightgear-a320', 'scripts/convert-aircraft.mjs', 'THIRD_PARTY_NOTICES.md'], {
  env: { ...process.env, COPYFILE_DISABLE: '1' }, stdio: 'inherit',
})
console.log('Packaged original aircraft sources, license and conversion script.')
