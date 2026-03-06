/**
 * Integration module for rendering PyMOL ray scenes via viewmol-ray-tracer.
 *
 * This bridges the gap between PyMOL WASM's getRayScene() JSON output and
 * the viewmol-ray-tracer's WebGPU compute-shader ray tracer.
 *
 * Usage (browser with WebGPU):
 *   import { renderRayScene } from './render.js';
 *   const rgba = await renderRayScene(sceneJSON, width, height);
 */

// The viewmol-ray-tracer bundle exposes ViewMolAPI as a global or CJS export.
// In a browser context, it's typically loaded via <script> tag which sets
// window.ViewMolAPI. For module-based usage, import the bundle directly.

/** Render settings matching viewmol-ray-tracer's settings object */
export interface RenderSettings {
    rayShadows?: number;
    rayTransparencyShadows?: number;
    ambient?: number;
    direct?: number;
    specPower?: number;
    specReflect?: number;
    specDirect?: number;
    specDirectPower?: number;
    specCount?: number;
    reflect?: number;
    gamma?: number;
    lightCount?: number;
    light?: number[];
    opaqueBg?: boolean;
    bgRgb?: number[];
    rayOversampleCutoff?: number;
    [key: string]: unknown;
}

/** Options for the render call */
export interface RenderOptions {
    executionProfile?: string;
    returnRGBA?: boolean;
    [key: string]: unknown;
}

/**
 * Renders a viewmol-ray-v2 scene JSON string using the viewmol-ray-tracer
 * WebGPU ray tracer.
 *
 * @param sceneJSON The JSON string from PyMOLHeadless.getRayScene()
 * @param width Output image width
 * @param height Output image height
 * @param settings Optional render settings (lighting, shadows, etc.)
 * @param renderOptions Optional render options (execution profile, etc.)
 * @returns RGBA pixel data as Uint8Array (width * height * 4 bytes), or null
 */
export async function renderRayScene(
    sceneJSON: string,
    width: number,
    height: number,
    settings?: RenderSettings,
    renderOptions?: RenderOptions
): Promise<Uint8Array | null> {
    // Get ViewMolAPI — available as global from <script> tag or require()
    const ViewMolAPI = getViewMolAPI();
    if (!ViewMolAPI) {
        throw new Error(
            'ViewMolAPI not found. Load viewmol-ray-tracer.js via <script> tag ' +
            'or require() before calling renderRayScene().'
        );
    }

    // Create API instance and renderer
    const api = new ViewMolAPI();
    const renderFn = createRenderFn(() => api);

    const mergedSettings: Record<string, unknown> = {
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
        bgRgb: [0, 0, 0],
        ...(settings || {})
    };

    const mergedOptions: Record<string, unknown> = {
        executionProfile: 'parity',
        returnRGBA: true,
        ...( renderOptions || {})
    };

    const rgba = await renderFn(sceneJSON, mergedSettings, width, height, mergedOptions);
    return rgba;
}

/**
 * Gets the ViewMolAPI constructor from the global scope.
 */
function getViewMolAPI(): (new () => any) | null {
    if (typeof globalThis !== 'undefined' && (globalThis as any).ViewMolAPI) {
        return (globalThis as any).ViewMolAPI;
    }
    if (typeof window !== 'undefined' && (window as any).ViewMolAPI) {
        return (window as any).ViewMolAPI;
    }
    if (typeof global !== 'undefined' && (global as any).ViewMolAPI) {
        return (global as any).ViewMolAPI;
    }
    return null;
}

/**
 * Creates a render function using viewmol-ray-tracer's createRenderSceneJSON pattern.
 * The viewmol-ray-tracer ESM module exports createRenderSceneJSON which takes
 * a factory function returning a ViewMolAPI instance.
 */
function createRenderFn(getAPI: () => any) {
    let _api: any = null;
    return async function(
        sceneJsonStr: string,
        settings: Record<string, unknown>,
        width: number,
        height: number,
        renderOptions: Record<string, unknown>
    ): Promise<Uint8Array | null> {
        if (!_api) _api = getAPI();
        const api = _api;
        // Use the API's built-in renderSceneJSON if available (from createRenderSceneJSON)
        if (typeof api.renderSceneJSON === 'function') {
            return api.renderSceneJSON(sceneJsonStr, settings, width, height, renderOptions);
        }
        throw new Error('ViewMolAPI instance does not have renderSceneJSON method');
    };
}
