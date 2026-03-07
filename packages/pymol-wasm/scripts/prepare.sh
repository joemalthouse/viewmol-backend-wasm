#!/usr/bin/env bash
#
# Prepares the PyMOL source tree for Emscripten WASM compilation.
#
#   1. Clones upstream PyMOL at the pinned version
#   2. Clones GLM (header-only math library)
#   3. Applies patches to upstream files
#   4. Copies overlay files (new custom code) into the tree
#
# Usage:
#   ./prepare.sh              # Clone + patch into vendor/
#   ./prepare.sh --clean      # Remove vendor/ and start fresh
#
# The result is vendor/pymol-open-source/ ready for emcmake cmake.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$PKG_DIR/vendor"

# Load version pins
# shellcheck source=../PYMOL_VERSION
source "$PKG_DIR/PYMOL_VERSION"

if [[ "${1:-}" == "--clean" ]]; then
    echo "Cleaning vendor directory..."
    rm -rf "$VENDOR_DIR"
    echo "Done."
    exit 0
fi

# --- Clone upstream PyMOL ---
PYMOL_DIR="$VENDOR_DIR/pymol-open-source"
if [[ -d "$PYMOL_DIR" ]]; then
    echo "PyMOL source already exists at $PYMOL_DIR"
    echo "  Use --clean to re-clone."
else
    echo "Cloning PyMOL $PYMOL_REF ..."
    mkdir -p "$VENDOR_DIR"
    git clone --depth 1 --branch "$PYMOL_REF" "$PYMOL_REPO" "$PYMOL_DIR"
    echo "  Cloned $(git -C "$PYMOL_DIR" rev-parse --short HEAD)"
fi

# --- Clone GLM ---
GLM_DIR="$VENDOR_DIR/glm"
if [[ -d "$GLM_DIR" ]]; then
    echo "GLM already exists at $GLM_DIR"
else
    echo "Cloning GLM $GLM_REF ..."
    git clone --depth 1 --branch "$GLM_REF" "$GLM_REPO" "$GLM_DIR"
fi

# --- Apply patches ---
echo "Applying patches..."
for patch in "$PKG_DIR/patches"/*.patch; do
    [[ -f "$patch" ]] || continue
    echo "  $(basename "$patch")"
    git -C "$PYMOL_DIR" apply --check "$patch" 2>/dev/null || {
        echo "  (already applied, skipping)"
        continue
    }
    git -C "$PYMOL_DIR" apply "$patch"
done

# --- Copy overlay files ---
echo "Copying overlay files..."
cp -r "$PKG_DIR/overlay/"* "$PYMOL_DIR/"
echo "  Copied: $(find "$PKG_DIR/overlay" -type f | wc -l) files"

# --- Verify CMakeLists.txt is in place ---
if [[ ! -f "$PYMOL_DIR/CMakeLists.txt" ]]; then
    echo "ERROR: CMakeLists.txt not found in $PYMOL_DIR"
    exit 1
fi

echo ""
echo "PyMOL source prepared at: $PYMOL_DIR"
echo "GLM headers at: $GLM_DIR"
echo "Ready for: emcmake cmake -B build -S $PYMOL_DIR"
