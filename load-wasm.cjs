// Workaround for Node 25 CJS module.exports reassignment issue.
// Loads pymol_wasm.js by wrapping it in a function to capture createPyMOL.
const fs = require('fs');
const path = require('path');

const wasmPath = path.resolve(__dirname, 'pymol-open-source/pymol_wasm.js');
const code = fs.readFileSync(wasmPath, 'utf8');

// Wrap the code in a function that receives the CJS bindings
// and returns createPyMOL after the IIFE + export code runs
const wrapper = new Function(
    'require', '__filename', '__dirname', 'module', 'exports',
    code + '\n; return typeof createPyMOL === "function" ? createPyMOL : module.exports;'
);

const fakeModule = { exports: {} };
const result = wrapper(
    require,
    wasmPath,
    path.dirname(wasmPath),
    fakeModule,
    fakeModule.exports
);

module.exports = result;
module.exports.default = result;
