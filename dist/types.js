"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenExchangeError = void 0;
/**
 * Custom error class for token exchange errors
 */
class TokenExchangeError extends Error {
    /**
     * Creates a new TokenExchangeError
     * @param message Error message
     * @param cause Underlying cause of the error
     */
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'TokenExchangeError';
    }
}
exports.TokenExchangeError = TokenExchangeError;
