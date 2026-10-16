# Third-party aircraft assets

The exterior, flight deck, instrument geometry, aircraft textures and sound samples are derived
from [FlightGear A320-family](https://github.com/legoboyvdlp/A320-family), pinned to
commit `fec1ecba767c8fffd145337b27012e89c01e3ade`.

Copyright (c) 2025 Josh Davidson, Jonathan Redpath, merspieler, Matthew Maring,
Thorsten Herrmann, Semir Gebran, and the respective upstream contributors.

These assets are distributed under GNU General Public License version 2. See
`vendor/flightgear-a320/LICENSE` and `public/models/a320/LICENSE.txt` for the full
license. Upstream's copyright notice is preserved in
`vendor/flightgear-a320/README.copyright.md`.

## Sources and modifications

- Original AC3D geometry, PNG/JPEG textures, WAV sounds and relevant model XML are retained
  in `vendor/flightgear-a320/`.
- `scripts/convert-aircraft.mjs` converts the geometry to glTF 2.0, preserving
  vertices, UVs, object names and original cockpit coordinates. It triangulates
  polygons and regenerates smooth normals. FlightGear XML is reference data;
  upstream executable simulation code is not run.
- The exterior uses the upstream SAS / Scandinavian SE-ROJ livery and LEAP-1A
  engines. Unused engine/wingtip variants are hidden at runtime.
- The web renderer batches static geometry, animates selected controls, drives
  annunciators, and replaces instrument screen textures with this application's
  simplified simulation displays. Fixed lettering and the opaque cockpit shell
  remain in their original positions.
- The cockpit and complete airframe use the placement in `A320-interior.xml`.
  Overhead button assemblies receive 1.5 mm of surface-normal clearance over
  baked panel geometry, preserving their footprint and original 0.75 mm travel.
- The model source archive at `public/models/a320/flightgear-source.tar.gz`
  includes the retained upstream source assets and conversion script. Rebuild
  it with `npm run models:source` after changes to source assets or conversion.

Redistributions of these model assets must retain the license, attribution,
modification notices and corresponding source. The project does not imply an
endorsement by Airbus, FlightGear or Scandinavian Airlines.

## Sound assets

The 18 unmodified WAV samples under `public/audio/a320/` come from the same pinned
upstream repository and GPL-2.0 distribution. `sources.json` maps each local
filename to its original `Sounds/` path. Original WAVs and the upstream common /
LEAP sound XML are retained under `vendor/flightgear-a320/Sounds/` and included in
the downloadable source archive. Upstream's LEAP sound configuration uses CFM56
samples; this application retains that provenance and does not claim these are
certified or type-specific LEAP recordings. The new browser mixer changes gain,
panning, playback rate and looping at runtime, without modifying the source WAVs.

The terminal, apron, ground-service vehicles, markings and procedural pavement
texture are application-authored geometry. Dark versions of button legends are
generated at runtime from upstream textures; original letter positions are kept.

## Reference documentation

Aircraft specifications are referenced from Airbus. Procedure and panel research
uses the linked FlyByWire A32NX documentation. Those documents are linked as
references; their cockpit reference images are not included in the application.

Application dependencies retain their respective licenses in the package
distribution. Exact dependency versions are recorded in `package-lock.json`.
