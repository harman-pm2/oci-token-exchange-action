"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenExchangeError = void 0;
/**
 * Custom error class for token exchange failures
 */
class TokenExchangeError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'TokenExchangeError';
    }
}
exports.TokenExchangeError = TokenExchangeError;
