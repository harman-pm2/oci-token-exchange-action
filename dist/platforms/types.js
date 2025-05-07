"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInput = resolveInput;
/**
 * Resolve an input name from various environment variable conventions.
 */
function resolveInput(name) {
    return (process.env[name.toUpperCase()] ||
        process.env[`INPUT_${name.toUpperCase()}`] ||
        process.env[`OCI_${name.toUpperCase()}`] ||
        process.env[`OIDC_${name.toUpperCase()}`] ||
        '');
}
