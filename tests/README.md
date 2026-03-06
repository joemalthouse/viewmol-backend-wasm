# WASM Parity Test Suite

Validates that PyMOL WASM C API commands produce identical internal state to native PyMOL by comparing rendered images through the same viewmol-ray-tracer WebGPU renderer.

## Pipeline

```
Native PyMOL (-cq script.py)          WASM PyMOL (Node.js)
  cmd.load(), cmd.show(), etc.          PyMOLWasm_Load(), PyMOLWasm_Show(), etc.
  _cmd.get_webgpu_scene()               PyMOLWasm_GetRayScene()
        |                                       |
        v                                       v
   scene_A.json                           scene_B.json
        |                                       |
        +--------> viewmol-ray-tracer <---------+
                   (same WebGPU renderer)
                          |
                    PSNR(image_A, image_B)
```

## Prerequisites

1. **Build WASM module:**
   ```bash
   cd pymol-open-source/build && emcmake cmake .. && make
   ```

2. **Start Chrome with WebGPU + remote debugging:**
   ```bash
   google-chrome --remote-debugging-port=9222 \
     --enable-features=Vulkan,UseSkiaRenderer \
     --enable-unsafe-webgpu
   ```

3. **Start viewmol-ray-tracer dev server:**
   ```bash
   cd ../viewmol-ray-tracer && npx serve .
   ```

4. **Install dependencies:**
   ```bash
   npm install playwright
   ```

## Running

```bash
# Run all 100 cases
npx tsx tests/wasm-parity.ts --suite all --save-images

# Run a specific category
npx tsx tests/wasm-parity.ts --suite rep
npx tsx tests/wasm-parity.ts --suite camera
npx tsx tests/wasm-parity.ts --suite transparency

# Run specific cases
npx tsx tests/wasm-parity.ts --cases wasm_rep_sticks,wasm_rep_cartoon

# List all available cases
npx tsx tests/wasm-parity.ts --list-cases

# Custom dimensions
npx tsx tests/wasm-parity.ts --width 1024 --height 576 --suite all
```

## Output

Results are saved to `artifacts/wasm-parity/<timestamp>/`:
- `report.md` — Summary table with PSNR/MAE per case
- `results.json` — Machine-readable results
- `*.native.png` / `*.wasm.png` — Rendered images (with `--save-images`)
- `*_native_scene.json` / `*_wasm_scene.json` — Scene JSONs (with `--save-images`)

A `latest` symlink always points to the most recent run.

## PSNR Thresholds

| Level | PSNR     | Meaning |
|-------|----------|---------|
| PASS  | >= 60 dB | Near pixel-identical |
| WARN  | 50-60 dB | Minor float precision differences |
| FAIL  | < 50 dB  | WASM command produced different state |

## Test Categories (100 cases)

| Category | Count | Tests |
|----------|-------|-------|
| Representations | 15 | lines, sticks, spheres, cartoon, ribbon, surface, mesh, dots, ball+stick, etc. |
| Colors | 10 | named colors, spectrum, per-chain, two-object, element-based |
| Camera/Rotation | 12 | default, Y/X/Z rotations, zoom in/out, perspective |
| Labels | 12 | shadow modes, font sizes, rotated, perspective, distance |
| Lighting/Shadows | 10 | ambient, direct, specular, two-sided, interior color |
| Transparency | 10 | 25/50/75%, sphere stack, oblique, contrast, nested, mixed |
| Background/Fog | 6 | black, white, gradient, fog on/dense/off |
| Ray Trace Modes | 6 | mode 0-3, outline variants |
| Texture/Effects | 5 | wobble, swirl, oversample, improved shadows, color ramps |
| Complex Scenes | 8 | multi-rep, two proteins, colored chains, rotated combos |
| Edge Cases | 6 | single atom, empty, huge/tiny sphere, max/far zoom |

## Files

| File | Description |
|------|-------------|
| `wasm-parity.ts` | Main test harness |
| `wasm-parity-cases.ts` | 100 test case definitions |
| `psnr.ts` | PSNR/MAE/RMSE utilities |
| `README.md` | This file |
