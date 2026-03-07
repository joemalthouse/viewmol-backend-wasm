/**
 * Browser render test: PyMOL WASM → getRayScene → viewmol-ray-tracer → RGBA output.
 *
 * Run with: npx vite (from viewmol/ directory), then open /test-render.html
 * Requires Chrome with WebGPU support.
 */

const PDB_DATA = `ATOM      1  N   ALA A   1      -0.612   0.093  -0.547  1.00  0.00           N
ATOM      2  CA  ALA A   1      -0.347   1.464  -0.088  1.00  0.00           C
ATOM      3  C   ALA A   1       1.155   1.698  -0.207  1.00  0.00           C
ATOM      4  O   ALA A   1       1.670   1.815  -1.312  1.00  0.00           O
ATOM      5  CB  ALA A   1      -0.817   1.666   1.353  1.00  0.00           C
ATOM      6  OXT ALA A   1       1.782   1.761   0.880  1.00  0.00           O
END`;

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    duration?: number;
}

const results: TestResult[] = [];

function log(msg: string) {
    const el = document.getElementById('log');
    if (el) el.textContent += msg + '\n';
    console.log(msg);
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function runTest(name: string, fn: () => Promise<void>) {
    const start = performance.now();
    try {
        await fn();
        const duration = performance.now() - start;
        results.push({ name, passed: true, message: 'OK', duration });
        log(`  PASS: ${name} (${duration.toFixed(0)}ms)`);
    } catch (e: any) {
        const duration = performance.now() - start;
        results.push({ name, passed: false, message: e.message || String(e), duration });
        log(`  FAIL: ${name} — ${e.message || e}`);
    }
}

async function main() {
    log('=== PyMOL WASM + viewmol-ray-tracer Integration Test ===\n');

    // Check WebGPU support
    if (!navigator.gpu) {
        log('ERROR: WebGPU not supported in this browser.');
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        log('ERROR: No WebGPU adapter available.');
        return;
    }
    log('WebGPU adapter found: ' + (adapter as any).name || 'unknown');

    // Load PyMOL WASM module
    log('\nLoading PyMOL WASM module...');
    let pymolModule: any;
    try {
        // The pymol_wasm.js and .wasm files should be in the public/ directory
        const createPyMOLModule = await import('/pymol_wasm.js');
        const createPyMOL = createPyMOLModule.default ?? createPyMOLModule;
        pymolModule = await createPyMOL({
            print: (text: string) => console.log('[PyMOL]', text),
            printErr: (text: string) => console.error('[PyMOL Err]', text),
            noInitialRun: true,
            locateFile: (path: string) => '/' + path
        });
        log('PyMOL WASM module loaded.');
    } catch (e: any) {
        log(`ERROR loading PyMOL WASM: ${e.message}`);
        log('Make sure pymol_wasm.js and pymol_wasm.wasm are in viewmol/public/');
        return;
    }

    // Initialize PyMOL
    const optionsPtr = pymolModule._PyMOLOptions_New();
    const pymolPtr = pymolModule._PyMOL_NewWithOptions(optionsPtr);
    pymolModule._PyMOL_Start(pymolPtr);
    log('PyMOL initialized.\n');

    // Test 1: Get ray scene JSON
    await runTest('getRayScene returns valid JSON', async () => {
        const textEncoder = new TextEncoder();
        const namePtr = pymolModule.stringToNewUTF8('test_mol');
        const pdbPtr = pymolModule.stringToNewUTF8(PDB_DATA);
        const selPtr = pymolModule.stringToNewUTF8('all');
        const repPtr = pymolModule.stringToNewUTF8('spheres');

        try {
            pymolModule._PyMOLWasm_Load(pymolPtr, namePtr, pdbPtr,
                textEncoder.encode(PDB_DATA).byteLength, 9);
            pymolModule._PyMOLWasm_Show(pymolPtr, repPtr, selPtr);
            pymolModule._PyMOLWasm_Zoom(pymolPtr, selPtr, 0);

            const bufSize = 2 * 1024 * 1024;
            const bufPtr = pymolModule._malloc(bufSize);
            try {
                const len = pymolModule._PyMOLWasm_GetRayScene(
                    pymolPtr, 320, 240, bufPtr, bufSize);
                assert(len > 0, `GetRayScene returned ${len}`);

                const jsonStr = pymolModule.UTF8ToString(bufPtr);
                const scene = JSON.parse(jsonStr);

                assert(scene.format === 'viewmol-ray-v2', 'Wrong format');
                assert(scene.primitive_count > 0, 'No primitives');
                assert(scene.width === 320, 'Wrong width');
                assert(scene.height === 240, 'Wrong height');

                log(`    Scene: ${scene.primitive_count} primitives, ` +
                    `${jsonStr.length} bytes JSON`);

                // Store for render test
                (window as any).__testSceneJSON = jsonStr;
                (window as any).__testScene = scene;
            } finally {
                pymolModule._free(bufPtr);
            }
        } finally {
            pymolModule._free(namePtr);
            pymolModule._free(pdbPtr);
            pymolModule._free(selPtr);
            pymolModule._free(repPtr);
        }
    });

    // Test 2: Render scene with viewmol-ray-tracer
    await runTest('viewmol-ray-tracer renders scene', async () => {
        const ViewMolAPI = (window as any).ViewMolAPI;
        if (!ViewMolAPI) {
            throw new Error(
                'ViewMolAPI not found — add <script src="viewmol-ray-tracer.js"> to the HTML');
        }

        const sceneJSON = (window as any).__testSceneJSON;
        assert(!!sceneJSON, 'No scene JSON from previous test');

        const api = new ViewMolAPI();
        const renderFn = api.createRenderSceneJSON
            ? api.createRenderSceneJSON(() => api)
            : null;

        if (!renderFn) {
            throw new Error('ViewMolAPI.createRenderSceneJSON not available');
        }

        const settings = {
            rayShadows: 1,
            ambient: 0.2,
            direct: 0.8,
            specPower: 55,
            specReflect: 0.5,
            reflect: 0.45,
            gamma: 1.0,
            lightCount: 1,
            light: [0, 0, -1],
            opaqueBg: true,
            bgRgb: [0, 0, 0]
        };

        const renderOptions = {
            executionProfile: 'parity',
            returnRGBA: true
        };

        const rgba = await renderFn(sceneJSON, settings, 320, 240, renderOptions);
        assert(rgba !== null, 'Render returned null');
        assert(rgba instanceof Uint8Array, 'Render output is not Uint8Array');
        assert(rgba.length === 320 * 240 * 4, `Wrong RGBA size: ${rgba.length}`);

        // Verify not entirely black
        let nonBlackPixels = 0;
        for (let i = 0; i < rgba.length; i += 4) {
            if (rgba[i] > 0 || rgba[i + 1] > 0 || rgba[i + 2] > 0) {
                nonBlackPixels++;
            }
        }
        assert(nonBlackPixels > 0, 'All pixels are black');
        log(`    Rendered: ${nonBlackPixels} non-black pixels out of ${320 * 240}`);

        // Display result on canvas
        const canvas = document.getElementById('result') as HTMLCanvasElement;
        if (canvas) {
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext('2d')!;
            const imageData = new ImageData(new Uint8ClampedArray(rgba.buffer), 320, 240);
            ctx.putImageData(imageData, 0, 0);
        }
    });

    // Cleanup
    pymolModule._PyMOL_Free(pymolPtr);
    pymolModule._PyMOLOptions_Free(optionsPtr);

    // Summary
    log('\n=== Results ===');
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    log(`${passed}/${total} tests passed`);

    if (passed === total) {
        log('\nAll tests passed!');
    }
}

main().catch(e => {
    log(`\nFATAL: ${e.message || e}`);
    console.error(e);
});
