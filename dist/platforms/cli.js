"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIPlatform = void 0;
/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
const types_1 = require("./types");
class CLIPlatform {
    constructor(config) {
        this.config = config;
        this._logger = {
            debug: (message) => { if (this.isDebug())
                console.debug(message); },
            info: (message) => console.log(message),
            warning: (message) => console.warn(message),
            error: (message) => console.error(message)
        };
    }
    getInput(name, required = false) {
        const value = (0, types_1.resolveInput)(name);
        if (required && !value) {
            throw new Error(`Input required and not supplied: ${name}`);
        }
        return value;
    }
    setOutput(name, value) {
        console.log(`::set-output name=${name}::${value}`);
    }
    setFailed(message) {
        console.error(message);
        process.exit(1);
    }
    isDebug() {
        return process.env.DEBUG === 'true';
    }
    async getOIDCToken(_audience) {
        if (this.config.tokenEnvVar) {
            const token = process.env[this.config.tokenEnvVar];
            if (!token) {
                throw new Error(`${this.config.tokenEnvVar} environment variable not found`);
            }
            // Do not log the token here
            return token;
        }
        throw new Error('No OIDC token configuration available');
    }
    get logger() {
        return this._logger;
    }
}
exports.CLIPlatform = CLIPlatform;
