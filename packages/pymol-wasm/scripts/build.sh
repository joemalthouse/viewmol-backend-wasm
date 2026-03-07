#!/usr/bin/env bash
#
# Builds PyMOL WASM from the prepared vendor/ tree.
#
# Prerequisites:
#   - Emscripten SDK activated (source emsdk_env.sh)
#   - prepare.sh has been run
#
# Usage:
#   ./build.sh                    # Build with ccache (default)
#   ./build.sh --no-ccache        # Build without ccache
#   JOBS=8 ./build.sh             # Override parallelism
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$PKG_DIR/vendor"
PYMOL_DIR="$VENDOR_DIR/pymol-open-source"
BUILD_DIR="$PKG_DIR/build"
OUT_DIR="$PKG_DIR/dist"

JOBS="${JOBS:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)}"
USE_CCACHE=1
if [[ "${1:-}" == "--no-ccache" ]]; then
    USE_CCACHE=0
fi

# Verify prerequisites
if ! command -v emcmake &>/dev/null; then
    echo "ERROR: Emscripten SDK not found. Source emsdk_env.sh first."
    exit 1
fi

if [[ ! -f "$PYMOL_DIR/CMakeLists.txt" ]]; then
    echo "ERROR: Prepared source not found. Run prepare.sh first."
    exit 1
fi

# Configure
echo "Configuring CMake build..."
CMAKE_EXTRA_ARGS=()
if [[ "$USE_CCACHE" == 1 ]] && command -v ccache &>/dev/null; then
    echo "  Using ccache"
    CMAKE_EXTRA_ARGS+=(
        -DCMAKE_C_COMPILER_LAUNCHER=ccache
        -DCMAKE_CXX_COMPILER_LAUNCHER=ccache
    )
fi

emcmake cmake \
    -B "$BUILD_DIR" \
    -S "$PYMOL_DIR" \
    -DCMAKE_BUILD_TYPE=Release \
    "${CMAKE_EXTRA_ARGS[@]}"

# Build
echo "Building with $JOBS parallel jobs..."
emmake make -C "$BUILD_DIR" -j"$JOBS"

# Copy outputs
mkdir -p "$OUT_DIR"
cp "$BUILD_DIR/pymol_wasm.js" "$OUT_DIR/"
cp "$BUILD_DIR/pymol_wasm.wasm" "$OUT_DIR/"

echo ""
echo "Build complete:"
ls -lh "$OUT_DIR/pymol_wasm.js" "$OUT_DIR/pymol_wasm.wasm"
