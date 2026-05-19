# Kiri:Moto CLI — User Guide

A headless command-line slicer built on the Kiri:Moto engine. Reads an STL file, slices it using JSON profiles, and outputs GCode — no browser, no GUI.

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Command Reference](#command-reference)
4. [Profile System](#profile-system)
5. [Device Profile](#device-profile)
6. [Process Profile — FDM](#process-profile--fdm)
7. [Process Profile — CAM](#process-profile--cam)
8. [Controller Profile](#controller-profile)
9. [CAM Tool Library](#cam-tool-library)
10. [Model Transforms](#model-transforms)
11. [GCode Macros](#gcode-macros)
12. [Scripting and Automation](#scripting-and-automation)
13. [Troubleshooting](#troubleshooting)

---

## Installation

**Requirements:** Node.js ≥ 22

```bash
# clone or download the repo, then:
cd kiri-moto
npm install
npm link        # makes 'kiri' available system-wide
```

After `npm link` the `kiri` command is available from any directory.

---

## Quick Start

```bash
# slice with built-in Ender 3 defaults, output to stdout
kiri model.stl

# slice to a file
kiri model.stl --output=model.gcode

# use custom profiles
kiri model.stl --device=my-printer.json --process=0.2mm-quality.json --output=model.gcode

# see all options
kiri --help
```

---

## Command Reference

```
kiri [options] <model.stl>
```

| Flag | Description |
|---|---|
| `<model.stl>` | Path to STL file (required, resolved from current directory) |
| `--output=<file>` | Write GCode to file. Omit to print to stdout |
| `--mode=FDM\|CAM\|LASER\|SLA` | Slicing mode. Defaults to the `mode` field in the device profile |
| `--device=<file.json>` | Printer/machine device profile |
| `--process=<file.json>` | Slicing settings profile |
| `--controller=<file.json>` | Controller settings (threading, assembly) |
| `--tools=<file.json>` | CAM tool library (CAM mode only) |
| `--position=x,y,z` | Move model to absolute position (mm) |
| `--move=x,y,z` | Translate model by offset (mm) |
| `--scale=x,y,z` | Scale model per-axis (1.0 = no change) |
| `--rotate=x,y,z` | Rotate model by x/y/z in **radians** |
| `--verbose` | Print engine messages and resolved options to stderr |
| `--help` | Print usage and exit |

All file paths resolve from your **current working directory**. The built-in default profiles (Ender 3, default process) are used when you don't specify a flag.

---

## Profile System

The CLI uses four JSON profile files that fully describe a slicing job:

| Profile | Controls | Default |
|---|---|---|
| Device | Printer hardware: bed size, nozzle, GCode preamble | Creality Ender 3 |
| Process | Slicing parameters: layer height, speeds, infill | 0.25mm / gyroid / 20% |
| Controller | Engine behaviour | single-threaded |
| Tools | CAM cutting tool library | inch end/ball mills |

The built-in defaults live in `src/cli/` inside the repo. Copy any of them as a starting point and pass your copy via the matching flag. You never need to edit the originals.

```bash
# copy the built-in defaults to your working directory
cp /path/to/kiri-moto/src/cli/kiri-fdm-device.json  my-printer.json
cp /path/to/kiri-moto/src/cli/kiri-fdm-process.json my-process.json
```

---

## Device Profile

The device profile describes the physical machine. The `mode` field determines the slicing engine used.

### Minimal FDM device

```json
{
    "mode": "FDM",
    "deviceName": "My Printer",
    "bedWidth": 235,
    "bedDepth": 235,
    "maxHeight": 250,
    "bedHeight": 2.5,
    "bedRound": false,
    "originCenter": false,
    "extrudeAbs": true,
    "extruders": [{
        "extFilament": 1.75,
        "extNozzle": 0.4,
        "extSelect": ["T0"],
        "extDeselect": [],
        "extOffsetX": 0,
        "extOffsetY": 0
    }],
    "gcodePre": [
        "M104 S{temp} T{tool}",
        "M140 S{bed_temp}",
        "G28",
        "M109 S{temp} T{tool}",
        "M190 S{bed_temp}",
        "G92 E0"
    ],
    "gcodePost": [
        "M104 S0",
        "M140 S0",
        "G1 X0 Y200 F3000",
        "M84"
    ],
    "gcodeFan": ["M106 S{fan_speed}"],
    "gcodeLayer": [],
    "gcodeTrack": [],
    "gcodePause": [],
    "gcodeDwell": [],
    "gcodeChange": [],
    "gcodeSpindle": [],
    "gcodeFExt": "gcode",
    "gcodeSpace": true,
    "gcodeStrip": false
}
```

### Device fields reference

#### Bed geometry

| Field | Type | Description |
|---|---|---|
| `bedWidth` | mm | Bed width (X axis) |
| `bedDepth` | mm | Bed depth (Y axis) |
| `maxHeight` | mm | Maximum print height (Z axis) |
| `bedHeight` | mm | Physical bed thickness (for Z offset calculation) |
| `bedRound` | bool | `true` for circular beds (e.g. delta printers) |
| `bedBelt` | bool | `true` for belt printers (e.g. CR-30) |
| `originCenter` | bool | `true` if firmware home is bed center (most deltas) |

#### Extruders

The `extruders` array supports multi-extruder setups. Each entry:

| Field | Type | Description |
|---|---|---|
| `extFilament` | mm | Filament diameter (1.75 or 2.85) |
| `extNozzle` | mm | Nozzle diameter (e.g. 0.4) |
| `extSelect` | string[] | GCode lines to select this extruder (e.g. `["T0"]`) |
| `extDeselect` | string[] | GCode lines to deselect this extruder |
| `extOffsetX` | mm | X offset from primary extruder |
| `extOffsetY` | mm | Y offset from primary extruder |

#### GCode sequences

Each sequence is an array of strings. Lines are emitted verbatim. [Macro variables](#gcode-macros) like `{temp}` are expanded at export time.

| Field | When emitted |
|---|---|
| `gcodePre` | Before the first layer |
| `gcodePost` | After the last layer |
| `gcodeLayer` | At the start of every layer |
| `gcodeTrack` | At the start of every track (move within a layer) |
| `gcodeFan` | When fan speed changes |
| `gcodePause` | At user-defined pause points |
| `gcodeDwell` | Dwell (wait) command template |
| `gcodeChange` | Tool change sequence |
| `gcodeSpindle` | Spindle speed change (CAM) |

#### Output formatting

| Field | Type | Description |
|---|---|---|
| `gcodeFExt` | string | File extension for output (`gcode`, `nc`, `g`, etc.) |
| `gcodeSpace` | bool | Add spaces between GCode parameters |
| `gcodeStrip` | bool | Strip comments from output |
| `extrudeAbs` | bool | Use absolute extrusion (`M82`) vs relative (`M83`) |

### Minimal CAM device

```json
{
    "mode": "CAM",
    "deviceName": "My CNC Router",
    "bedWidth": 800,
    "bedDepth": 800,
    "maxHeight": 100,
    "originCenter": false,
    "spindleMax": 24000,
    "gcodePre": [
        "G21",
        "G90",
        "G0 F6000"
    ],
    "gcodePost": ["M30"],
    "gcodeDwell": ["G4 P{time}"],
    "gcodeSpindle": ["M3 S{spindle}"],
    "gcodeChange": ["M6 T{tool}"],
    "gcodeFExt": "nc",
    "gcodeSpace": true,
    "gcodeStrip": false
}
```

---

## Process Profile — FDM

The process profile controls all slicing parameters. Every field is optional — omit it and the engine uses its internal default.

### Layer settings

| Field | Type | Description |
|---|---|---|
| `sliceHeight` | mm | Layer height (e.g. `0.2`) |
| `firstSliceHeight` | mm | First layer height. Defaults to `sliceHeight` |
| `sliceAdaptive` | bool | Enable adaptive layer heights |
| `sliceMinHeight` | mm | Minimum height when adaptive is on |

### Shells

| Field | Type | Description |
|---|---|---|
| `sliceShells` | int | Number of perimeter shells |
| `sliceShellOrder` | string | `"in-out"` or `"out-in"` |
| `sliceLayerStart` | string | Shell seam position: `"last"`, `"center"`, `"random"` |
| `detectThinWalls` | bool | Fill gaps between shells narrower than one nozzle width |

### Infill

| Field | Type | Description |
|---|---|---|
| `sliceFillSparse` | 0–1 | Infill density (0 = none, 1 = solid) |
| `sliceFillType` | string | Pattern: `"gyroid"`, `"grid"`, `"hex"`, `"triangle"`, `"linear"`, `"cubic"`, `"stars"`, `"cross"` |
| `sliceFillAngle` | degrees | Infill angle offset |
| `sliceFillOverlap` | 0–1 | Infill overlap with perimeters |
| `sliceFillRate` | mm/s | Infill speed (0 = use `outputFeedrate`) |
| `sliceSolidMinArea` | mm² | Minimum area to fill as solid |
| `sliceTopLayers` | int | Solid top layers |
| `sliceBottomLayers` | int | Solid bottom layers |

### Speeds (mm/s)

| Field | Description |
|---|---|
| `outputFeedrate` | General print speed |
| `outputFinishrate` | Outer perimeter speed |
| `outputSeekrate` | Travel (non-print) speed |
| `firstLayerRate` | First layer print speed |
| `firstLayerFillRate` | First layer infill speed |
| `outputMinSpeed` | Minimum speed (for small features) |

### Temperatures

| Field | Description |
|---|---|
| `outputTemp` | Hotend temperature (°C) |
| `outputBedTemp` | Bed temperature (°C) |
| `firstLayerNozzleTemp` | Override nozzle temp for first layer (0 = use `outputTemp`) |
| `firstLayerBedTemp` | Override bed temp for first layer (0 = use `outputBedTemp`) |

### Fan

| Field | Description |
|---|---|
| `outputFanSpeed` | Fan speed, 0–255 |
| `firstLayerFanSpeed` | Fan speed for first layer (usually 0) |

### Extrusion multipliers

| Field | Description |
|---|---|
| `outputShellMult` | Shell extrusion multiplier (e.g. `1.25`) |
| `outputFillMult` | Solid fill extrusion multiplier |
| `outputSparseMult` | Sparse infill extrusion multiplier |
| `firstLayerPrintMult` | First layer extrusion multiplier |
| `firstLayerLineMult` | First layer line width multiplier |

### Retraction

| Field | Description |
|---|---|
| `outputRetractDist` | mm | Retraction distance |
| `outputRetractSpeed` | mm/s | Retraction speed |
| `outputRetractDwell` | ms | Dwell after retract |
| `outputRetractWipe` | mm | Wipe distance before retract |
| `outputLayerRetract` | bool | Retract between layers |
| `outputCoastDist` | mm | Coast (stop extruding) before end of line |

### Brim and raft

| Field | Description |
|---|---|
| `firstLayerBrim` | mm | Brim width around the first layer |
| `firstLayerBrimTrig` | mm² | Minimum footprint area to trigger auto brim |
| `outputBrimCount` | int | Number of brim loops |
| `outputBrimOffset` | mm | Gap between brim and part |
| `outputRaft` | bool | Enable raft |
| `outputRaftSpacing` | mm | Air gap between raft and first layer |

### Supports

Supports require minion workers and are **disabled by default** in headless mode. To experiment, set `sliceSupportType` to anything other than `"disabled"` — but note results may hang.

| Field | Description |
|---|---|
| `sliceSupportType` | `"disabled"` (default), `"auto"`, `"manual"` |
| `sliceSupportEnable` | bool — master enable |
| `sliceSupportAngle` | degrees — overhang angle threshold |
| `sliceSupportDensity` | 0–1 — support fill density |
| `sliceSupportOffset` | mm — XY clearance from part |
| `sliceSupportGap` | mm — Z gap (air gap) between support and part |
| `sliceSupportSize` | mm — support pillar size |
| `sliceSupportArea` | mm² — minimum overhang area to support |
| `sliceSupportExtra` | mm — extra support margin |
| `sliceSupportNozzle` | index — which extruder to use for supports |

### Miscellaneous

| Field | Description |
|---|---|
| `zHopDistance` | mm — Z hop height during travel |
| `arcTolerance` | mm — arc fitting tolerance (0 = off) |
| `antiBacklash` | int — backlash compensation steps |
| `outputLoopLayers` | int or null — spiral vase mode layer count |
| `outputInvertX` | bool — mirror output on X |
| `outputInvertY` | bool — mirror output on Y |
| `ctOriginCenter` | bool — treat bed origin as center |

### Example: 0.2mm quality profile

```json
{
    "sName": "quality-0.2mm",
    "sliceHeight": 0.2,
    "firstSliceHeight": 0.3,
    "sliceShells": 3,
    "sliceShellOrder": "in-out",
    "sliceLayerStart": "last",
    "sliceFillSparse": 0.25,
    "sliceFillType": "gyroid",
    "sliceFillOverlap": 0.3,
    "sliceTopLayers": 4,
    "sliceBottomLayers": 4,
    "sliceSupportType": "disabled",
    "outputTemp": 215,
    "outputBedTemp": 65,
    "outputFeedrate": 60,
    "outputFinishrate": 40,
    "outputSeekrate": 100,
    "firstLayerRate": 20,
    "firstLayerFanSpeed": 0,
    "outputFanSpeed": 255,
    "outputShellMult": 1.25,
    "outputFillMult": 1.25,
    "outputSparseMult": 1.25,
    "firstLayerPrintMult": 1.1,
    "outputRetractDist": 5,
    "outputRetractSpeed": 45,
    "outputRetractDwell": 0,
    "outputLayerRetract": true,
    "outputCoastDist": 0.1,
    "detectThinWalls": true,
    "zHopDistance": 0
}
```

### Example: draft 0.3mm fast profile

```json
{
    "sName": "draft-0.3mm",
    "sliceHeight": 0.3,
    "firstSliceHeight": 0.35,
    "sliceShells": 2,
    "sliceFillSparse": 0.15,
    "sliceFillType": "grid",
    "sliceTopLayers": 3,
    "sliceBottomLayers": 3,
    "sliceSupportType": "disabled",
    "outputTemp": 210,
    "outputBedTemp": 60,
    "outputFeedrate": 80,
    "outputFinishrate": 50,
    "outputSeekrate": 120,
    "firstLayerRate": 25,
    "firstLayerFanSpeed": 0,
    "outputFanSpeed": 255,
    "outputRetractDist": 4,
    "outputRetractSpeed": 40,
    "outputLayerRetract": false,
    "detectThinWalls": false
}
```

---

## Process Profile — CAM

CAM mode mills a 3D model using a set of operations. The `ops` array defines what the machine does, in order.

### Stock geometry

| Field | Description |
|---|---|
| `camStockX` | mm — stock block X size |
| `camStockY` | mm — stock block Y size |
| `camStockZ` | mm — stock block Z size |
| `camStockOffset` | bool — add stock as offset around model |
| `camOriginTop` | bool — Z origin at top of stock (most common) |
| `camZAnchor` | `"top"`, `"middle"`, `"bottom"` — where model sits in stock |
| `camZOffset` | mm — manual Z offset |
| `camZBottom` | mm — depth of final floor cut |
| `camZClearance` | mm — clearance height for rapid moves |
| `camZThru` | mm — extra depth to cut fully through stock |

### Feed rates

| Field | Description |
|---|---|
| `camFastFeed` | mm/min — rapid travel speed |
| `camFastFeedZ` | mm/min — rapid Z speed |
| `camTolerance` | mm — curve approximation tolerance |

### Operations array

The `ops` array is processed in order. Each operation has:

```json
{
    "type": "rough|outline|contour|trace|drill|helical",
    "tool": 1001,
    "spindle": 10000,
    "rate": 1000,
    "plunge": 250,
    "down": 3,
    "step": 0.5,
    "leave": 0
}
```

**Operation types:**

| Type | Description |
|---|---|
| `rough` | Horizontal roughing passes to clear stock |
| `outline` | Profile cut around part perimeter |
| `contour` | 3D surface finishing (X or Y passes) |
| `trace` | Follow a traced path |
| `drill` | Drill cycles |
| `helical` | Helical (spiral) hole milling |

**Common operation fields:**

| Field | Description |
|---|---|
| `tool` | Tool `id` from the tool library |
| `spindle` | RPM |
| `rate` | mm/min — cutting feed rate |
| `plunge` | mm/min — plunge (Z down) rate |
| `down` | mm — depth per pass |
| `step` | fraction — stepover (0.5 = 50% tool diameter) |
| `leave` | mm — stock to leave (for roughing before finishing) |
| `inside` | bool — cut inside pocket |
| `top` | bool — include top face |
| `voids` | bool — clear internal voids |

### Example: rough + contour finish

```json
{
    "processName": "two-pass",
    "camStockX": 100,
    "camStockY": 100,
    "camStockZ": 30,
    "camStockOffset": false,
    "camOriginTop": true,
    "camZClearance": 5,
    "camZThru": 0,
    "camFastFeed": 4000,
    "camFastFeedZ": 500,
    "camTolerance": 0.05,
    "ops": [
        {
            "type": "rough",
            "tool": 1001,
            "spindle": 18000,
            "rate": 1200,
            "plunge": 300,
            "down": 4,
            "step": 0.45,
            "leave": 0.3,
            "inside": true,
            "voids": false,
            "top": false
        },
        {
            "type": "contour",
            "tool": 2001,
            "spindle": 20000,
            "rate": 800,
            "step": 0.2,
            "inside": true
        }
    ]
}
```

---

## Controller Profile

A small file that controls engine behaviour. For the CLI you normally leave this as-is.

```json
{
    "threaded": false,
    "assembly": false
}
```

| Field | Description |
|---|---|
| `threaded` | Enable multi-threaded slicing. **Must be `false`** for the CLI — worker pool is not available headlessly |
| `assembly` | Enable multi-body assembly mode |

---

## CAM Tool Library

An array of tool definitions. Each tool has a unique `id` that is referenced by process operations.

```json
[
    {
        "id": 1000,
        "number": 1,
        "type": "endmill",
        "name": "6mm flat end",
        "metric": true,
        "shaft_diam": 6,
        "shaft_len": 25,
        "flute_diam": 6,
        "flute_len": 22,
        "taper_tip": 0
    },
    {
        "id": 2000,
        "number": 2,
        "type": "ballmill",
        "name": "4mm ball",
        "metric": true,
        "shaft_diam": 4,
        "shaft_len": 25,
        "flute_diam": 4,
        "flute_len": 20,
        "taper_tip": 0
    },
    {
        "id": 3000,
        "number": 3,
        "type": "drill",
        "name": "3mm drill",
        "metric": true,
        "shaft_diam": 3,
        "shaft_len": 40,
        "flute_diam": 3,
        "flute_len": 20,
        "taper_tip": 118
    }
]
```

### Tool fields

| Field | Description |
|---|---|
| `id` | Unique integer — referenced by `ops[].tool` in the process |
| `number` | Tool slot / carousel position |
| `type` | `"endmill"`, `"ballmill"`, `"drill"`, `"tapermill"` |
| `name` | Human-readable label |
| `metric` | `true` = mm, `false` = inches |
| `shaft_diam` | Shank diameter |
| `shaft_len` | Total tool length |
| `flute_diam` | Cutting diameter |
| `flute_len` | Cutting length |
| `taper_tip` | Tip angle for drills (e.g. `118`), `0` for flat tools |

---

## Model Transforms

Transforms are applied before slicing, in this order: **parse → position/move → scale → rotate → slice**.

### `--position=x,y,z`
Move the model so its origin lands at the given absolute position in bed space (mm).

```bash
# center the model at X=110, Y=110 (center of Ender 3 bed), Z=0
kiri model.stl --position=110,110,0 --output=out.gcode
```

### `--move=x,y,z`
Translate by a relative offset from wherever the model currently is.

```bash
# shift 10mm right and 5mm forward
kiri model.stl --move=10,5,0 --output=out.gcode
```

### `--scale=x,y,z`
Scale each axis independently. `1.0` = no change.

```bash
# double the size uniformly
kiri model.stl --scale=2,2,2 --output=out.gcode

# stretch only in Z (make it taller)
kiri model.stl --scale=1,1,1.5 --output=out.gcode

# mirror on X axis
kiri model.stl --scale=-1,1,1 --output=out.gcode
```

### `--rotate=x,y,z`
Rotate around each axis in **radians**. Common values:

| Degrees | Radians |
|---|---|
| 90° | `1.5708` |
| 180° | `3.1416` |
| 270° | `4.7124` |
| 45° | `0.7854` |

```bash
# lay model on its back (rotate 90° around X)
kiri model.stl --rotate=1.5708,0,0 --output=out.gcode

# rotate 45° around Z
kiri model.stl --rotate=0,0,0.7854 --output=out.gcode
```

---

## GCode Macros

Strings in `gcodePre`, `gcodePost`, `gcodeLayer`, `gcodeFan`, etc. can contain `{variable}` tokens that are expanded at export time.

### FDM macro variables

| Variable | Value |
|---|---|
| `{temp}` | Hotend target temperature |
| `{bed_temp}` | Bed target temperature |
| `{fan_speed}` | Fan speed (0–255) |
| `{tool}` | Active extruder index |
| `{layer}` | Current layer number |
| `{height}` | Current Z height (mm) |
| `{pos_x}` | Current X position |
| `{pos_y}` | Current Y position |

### CAM macro variables

| Variable | Value |
|---|---|
| `{spindle}` | Spindle RPM |
| `{tool}` | Tool number |
| `{tool_name}` | Tool name string |
| `{time}` | Dwell time in ms |

### Example: layer progress comment

```json
"gcodeLayer": ["; layer {layer} at Z={height}mm"]
```

### Example: conditional fan (disable for first 3 layers)

Use the layer number in your slicer logic. The fan command is generated automatically by the engine when fan speed changes — you just need the `gcodeFan` template:

```json
"gcodeFan": ["M106 S{fan_speed} ; fan"]
```

---

## Scripting and Automation

### Pipe GCode into another tool

```bash
kiri model.stl | gcode-simulator
kiri model.stl | grep "^G1" | wc -l    # count move commands
```

### Batch slice a folder

```bash
for f in models/*.stl; do
    name=$(basename "$f" .stl)
    kiri "$f" --output="gcode/${name}.gcode"
    echo "sliced $name"
done
```

### Override a single process setting on the fly

The CLI doesn't support inline key=value overrides yet, but you can generate a profile with a script:

```bash
# create a temporary process with a custom layer height
node -e "
const base = JSON.parse(require('fs').readFileSync('my-process.json'));
base.sliceHeight = 0.15;
require('fs').writeFileSync('/tmp/fine.json', JSON.stringify(base));
"
kiri model.stl --process=/tmp/fine.json --output=fine.gcode
```

### npm run alias

The `slice` script in `package.json` is a shorthand when you're inside the repo directory:

```bash
npm run slice -- model.stl --output=out.gcode
```

---

## Troubleshooting

### `error: no model file specified`
You must pass the STL path. Either as the last argument or explicitly:
```bash
kiri --output=out.gcode model.stl
kiri --model=model.stl --output=out.gcode
```

### `ENOENT: no such file or directory` on a profile
File paths resolve from your **current directory**. Use an absolute path or `cd` to the right place first.

```bash
kiri model.stl --device=/absolute/path/to/my-printer.json
```

### No output, process exits silently
Run with `--verbose` to see what the engine is doing:
```bash
kiri model.stl --verbose --output=out.gcode
```

### GCode is empty or very short
The model may be outside the bed bounds or scaled to zero. Check with:
```bash
kiri model.stl --verbose 2>&1 | head -30
```
Try centering the model explicitly:
```bash
kiri model.stl --position=110,110,0 --output=out.gcode
```

### `threaded` mode hangs
The worker pool is not available in headless mode. Make sure `controller.json` has `"threaded": false`. This is the default.

### Supports hang / never finish
Support generation (`sliceSupportType` other than `"disabled"`) requires the minion worker pool which is not available headlessly. Keep `"sliceSupportType": "disabled"` in your process profile. Add supports manually in your slicer of choice before printing if needed.

### CAM mode not producing output
CAM mode is untested in the headless CLI. FDM is the confirmed-working mode. LASER and SLA are also untested.

### `Cannot find module` errors after moving the repo
Re-run `npm link` from the repo directory after moving it:
```bash
cd /new/path/to/kiri-moto
npm link
```
