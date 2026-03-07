/**
 * ViewMol Ray Tracer — WebGPU compute-shader ray tracer.
 *
 * This package implements the GPU ray tracing engine that consumes
 * viewmol-ray-v2 scene JSON (or viewmol-bin-v1 binary) and produces
 * RGBA pixel output via WebGPU compute shaders.
 *
 * TODO: Implement WebGPU rendering pipeline.
 */

export class ViewMolAPI {
    async renderSceneJSON(
        sceneJSON: string,
        settings: Record<string, unknown>,
        width: number,
        height: number,
        options: Record<string, unknown>,
    ): Promise<Uint8Array | null> {
        throw new Error('ViewMolAPI.renderSceneJSON() not yet implemented');
    }

    async renderSceneBinary(
        sceneBinary: Uint8Array,
        settings: Record<string, unknown>,
        width: number,
        height: number,
        options: Record<string, unknown>,
    ): Promise<Uint8Array | null> {
        throw new Error('ViewMolAPI.renderSceneBinary() not yet implemented');
    }
}
