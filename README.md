<a id="top"></a>

<div align="center">

<p><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>

<img src="public/favicon.svg" alt="Flight Simulator logo" width="64" height="64" />

<h1>FLIGHT SIMULATOR</h1>

<p><strong>Your A320 flight deck, in the browser.</strong></p>
<p>Explore the aircraft. Operate the cockpit. Bring its systems to life.</p>

<p>
  <a href="package.json"><img src="https://img.shields.io/badge/version-0.1.0-c5ee8b?style=flat-square&amp;logo=github&amp;logoColor=white&amp;labelColor=172019" alt="Project version 0.1.0" /></a>
  <a href="#development"><img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&amp;logo=react&amp;logoColor=61dafb&amp;labelColor=172019" alt="React 19" /></a>
  <a href="#development"><img src="https://img.shields.io/badge/TypeScript-7-3178c6?style=flat-square&amp;logo=typescript&amp;logoColor=white&amp;labelColor=172019" alt="TypeScript 7" /></a>
  <a href="#development"><img src="https://img.shields.io/badge/Three.js-WebGL-a7c6bd?style=flat-square&amp;logo=threedotjs&amp;logoColor=white&amp;labelColor=172019" alt="Three.js and WebGL" /></a>
  <a href="#development"><img src="https://img.shields.io/badge/Vite-8-646cff?style=flat-square&amp;logo=vite&amp;logoColor=white&amp;labelColor=172019" alt="Vite 8" /></a>
  <a href="THIRD_PARTY_NOTICES.md"><img src="https://img.shields.io/badge/assets-GPL--2.0-c5ee8b?style=flat-square&amp;labelColor=172019" alt="Aircraft and sound assets: GPL-2.0" /></a>
</p>

<p>
  <a href="#overview">Overview</a> ·
  <a href="#showcase">Showcase</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#controls">Controls</a> ·
  <a href="#deployment">Deployment</a> ·
  <a href="#development">Development</a>
</p>

</div>

<p align="center">
  <img src="docs/media/cockpit.jpg" alt="A320 cockpit with the main instruments, FCU and center pedestal in their original positions" width="100%" />
  <br />
  <sub>Actual application capture · Original cockpit layout · Direct 3D interaction</sub>
</p>

<table align="center">
  <tr>
    <td align="center" width="33%"><strong>A320neo</strong><br /><sub>Full cockpit &amp; airframe</sub></td>
    <td align="center" width="33%"><strong>18 steps</strong><br /><sub>Guided cold-and-dark startup</sub></td>
    <td align="center" width="33%"><strong>72 keys / MCDU</strong><br /><sub>Both units, in their original positions</sub></td>
  </tr>
</table>

<a id="overview"></a>

## Overview

**FLIGHT SIMULATOR** is an interactive 3D cockpit project for aviation enthusiasts, built with React, TypeScript and Three.js. Start with an Airbus A320neo, move freely around its flight deck, and operate supported switches, knobs and keys directly on the model. Mechanical movement, annunciators, instrument displays and audio respond to the same aircraft state.

Follow a guided session from cold and dark through electrical power, APU startup, MCDU initialization and engine start, or choose free exploration to inspect the systems at your own pace. The cockpit uses detailed FlightGear A320-family assets with their original panel positions. The application runs as a static website and saves session progress in your browser.

| Experience | What's included |
| --- | --- |
| **Explore the aircraft** | Complete cockpit and airframe; captain, overhead, instrument, MCDU, pedestal and exterior views; orbit, zoom and pan. |
| **Operate the panels** | Supported switches and pushbuttons with movement, visible legends, annunciators and live instrument feedback. |
| **Follow the startup** | An 18-step checklist covering electrical power, fire tests, oxygen, signs, ADIRS, fuel, APU, bleed air, MCDU and engine start. |
| **Observe the systems** | Power transfer, APU startup and cooldown, staged engine starts, N2 / EGT / fuel flow, PACK, hydraulics, flaps, ECAM and selected FCU functions. |
| **Hear the feedback** | 18 local WAV samples for controls, relays, ventilation, APU, engines, flaps, PTU and alerts, with interior / exterior mixing. |
| **Set the scene** | A training airport with a terminal, jet bridges, ground equipment, taxiways and runway; day, dusk and night settings. |
| **Practice and review** | Guided / free modes, 1× / 5× / 10× time scaling, pause, browser autosave and JSON event-log export. |

> [!NOTE]
> The current scope is **ground preparation and cockpit interaction**. Full flight dynamics, pushback / taxi, global scenery, a navigation database, complete FMGS / autopilot and all failure modes are not implemented. System behavior is simplified for exploration and learning, not real-world aircraft operation or certified training.

<a id="showcase"></a>

## In the cockpit

The recordings below come from the running application. GIFs have no audio; the APU demonstration uses accelerated simulation time.

<table align="center">
  <tr>
    <th width="58%">APU startup &amp; annunciators</th>
    <th width="42%">MCDU input</th>
  </tr>
  <tr>
    <td align="center" valign="top"><img src="docs/media/overhead-start.gif" alt="Clicking the physical APU MASTER and START buttons; ON and AVAIL indications respond" width="450" /></td>
    <td align="center" valign="top"><img src="docs/media/mcdu-input.gif" alt="Entering ZSPD/ZBAA with the physical MCDU keyboard and inserting it on the INIT page" width="300" /></td>
  </tr>
  <tr>
    <td>Use the original overhead buttons and watch the system state change.</td>
    <td>Type on the model, then insert an entry with a line-select key.</td>
  </tr>
</table>

### Around the aircraft

Inspect the complete airframe from the apron, nose, engine and tail views.

<p align="center">
  <img src="docs/media/exterior-tour.gif" alt="A320 exterior tour showing the parked aircraft, nose, engines and tail" width="960" />
</p>

<details>
<summary><strong>More screenshots — hangar, exterior, overhead and MCDU</strong></summary>

| Hangar & session setup | Aircraft & airport |
| --- | --- |
| ![Aircraft selection and session settings](docs/media/hangar.jpg) | ![A320neo parked at the terminal](docs/media/exterior.jpg) |

| Overhead panel | MCDU close-up |
| --- | --- |
| ![Original APU and lighting controls](docs/media/overhead.jpg) | ![MCDU INIT page and complete keyboard](docs/media/mcdu.jpg) |

</details>

<a id="quick-start"></a>

## Quick start

**Requirements:** Node.js `^20.19.0 || >=22.12.0`, npm and a browser with WebGL support.

```bash
git clone https://github.com/radebit/flight-simulator.git
cd flight-simulator
npm ci
npm run dev
```

Open **<http://127.0.0.1:5173/>**.

For a first session, select **冷舱启动 (Cold & Dark)** and **引导练习 (Guided)**. Follow the checklist and click a step to locate its panel. To explore a powered cockpit, select **地面电源已接通 (Ground Power Connected)** and **自由探索 (Free Exploration)**. The current application interface is in Simplified Chinese, with English aircraft labels.

Models and audio are bundled with the project. The exterior model is approximately 10 MB and the cockpit approximately 51 MB, so allow time for the initial download.

<a id="controls"></a>

## Controls

| Action | Input |
| --- | --- |
| Switch panels | Top navigation or number keys `1`–`6` |
| Move the view | Drag to orbit, scroll to zoom, right-drag to pan |
| Operate controls | Click the original model position; enable **操作提示 (Control Hints)** to find supported controls |
| Adjust a knob | Scroll / arrow keys where supported; `Shift` + click to reverse |
| Fire / lamp test | Hold TEST; release to stop |
| MCDU entry | Click physical keys, or type with the computer keyboard after focusing the MCDU |
| MCDU delete | `CLR` deletes a character; `Delete` clears the scratchpad |
| Pause / resume | Top timer button, or `Space` when not focused on an input control |
| Audio | Enabled after the first interaction; use the top mute button or volume in settings |

<details>
<summary><strong>Try it: MCDU INIT A entries</strong></summary>

Enter a value into the scratchpad, then press the corresponding line-select key.

| Entry | Key | Field |
| --- | --- | --- |
| `ZSPD/ZBAA` | `1R` | Origin / destination |
| `AD320` | `3L` | Flight number |
| `30` | `5L` | Cost index |
| `350` | `6L` | Cruise flight level |

</details>

<a id="deployment"></a>

## Deployment

Build a static site for OpenResty, Nginx or another static file server. No production Node.js process is required.

**Site root — default**

```bash
npm run build
```

Upload **the contents of `dist/`** directly to the site's document root.

**Subdirectory — optional**

```bash
npm run build -- --base=/flight-simulator/
```

Replace the example with your own subdirectory and upload the contents of `dist/` to that matching directory. The flag applies only to this build; the default remains `/`. Keep the leading and trailing `/`, and upload `assets/`, `models/`, `audio/` and `favicon.svg` together with `index.html`.

See the [OpenResty configuration](docs/openresty.conf) and the [deployment & troubleshooting guide (中文)](docs/DEPLOYMENT.md).

<a id="development"></a>

## Development

| Layer | Technology |
| --- | --- |
| Interface & types | React 19 · TypeScript 7 |
| 3D rendering | Three.js · React Three Fiber · Drei |
| Simulation & sound | Independent state logic · Web Audio API |
| Build & tests | Vite 8 · Vitest |

Exact dependency versions are recorded in [`package-lock.json`](package-lock.json).

```bash
npm test          # Run the test suite
npm run build     # Type-check and build into dist/
npm run preview   # Preview the production build locally
```

<details>
<summary><strong>Project structure</strong></summary>

```text
src/
  App.tsx                 # Hangar, simulation session and checklist
  assetUrl.ts             # Public asset paths follow the build base
  sim/                    # Aircraft systems, procedures and MCDU logic
  scene/                  # Cockpit, airframe, controls and airport
  audio/                  # Audio loading and mixing
public/
  models/a320/            # GLB models, manifests, license and source archive
  audio/a320/             # WAV files and source mapping
vendor/flightgear-a320/   # Pinned upstream geometry, textures and sounds
scripts/                 # Model conversion and source packaging
tests/                   # System, audio and model regression tests
docs/                    # Screenshots, recordings and deployment guide
```

</details>

## Aircraft assets & credits

Aircraft geometry, textures and sound samples come from **[FlightGear A320-family](https://github.com/legoboyvdlp/A320-family)** and are distributed under **GPL-2.0**. Original source assets, license text and modification notices are retained in the repository.

See [third-party notices](THIRD_PARTY_NOTICES.md), [asset modifications](public/models/a320/NOTICE.txt) and the [asset license](public/models/a320/LICENSE.txt). The assets badge above describes these bundled resources. This project is not affiliated with or endorsed by Airbus, FlightGear or Scandinavian Airlines.

---

<p align="center">
  <a href="#top">Back to top</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="https://github.com/radebit/flight-simulator/issues">Report an issue</a>
</p>
