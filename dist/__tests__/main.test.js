"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const io = __importStar(require("@actions/io"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const main_1 = require("../main"); // Adjust the import path as needed
// Mock dependencies
jest.mock('@actions/io');
jest.mock('fs');
jest.mock('path');
describe('main.ts', () => {
    const publicKey = crypto.createPublicKey({
        key: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7v5z5J5x5J5x5J5x5J5x\n-----END PUBLIC KEY-----\n',
        format: 'pem',
    });
    const privateKey = crypto.createPrivateKey({
        key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDv/nPknnHknnHk\n-----END PRIVATE KEY-----\n',
        format: 'pem',
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('configureOciCli', () => {
        // Test fixtures
        const mockTestData = {
            home: '/mock/home',
            upstToken: 'mockUpstToken',
            ociUser: 'mockOciUser',
            ociFingerprint: 'mockOciFingerprint',
            ociTenancy: 'mockOciTenancy',
            ociRegion: 'mockOciRegion'
        };
        beforeEach(() => {
            jest.clearAllMocks();
            process.env.HOME = mockTestData.home;
        });
        afterEach(() => {
            jest.resetAllMocks();
            delete process.env.HOME;
        });
        describe('successful configuration', () => {
            it('should configure OCI CLI with the UPST token', async () => {
                const mockOciConfigDir = path.join(mockTestData.home, '.oci');
                const mockOciConfigFile = path.join(mockOciConfigDir, 'config');
                const mockOciPrivateKeyFile = path.join(mockTestData.home, 'private_key.pem');
                const mockOciPublicKeyFile = path.join(mockTestData.home, 'public_key.pem');
                const mockUpstTokenFile = path.join(mockTestData.home, 'session');
                io.mkdirP.mockResolvedValue(undefined);
                fs.existsSync.mockReturnValue(true);
                fs.writeFileSync.mockImplementation(() => { });
                await (0, main_1.configureOciCli)(privateKey, publicKey, mockTestData.upstToken, mockTestData.ociFingerprint, mockTestData.ociTenancy, mockTestData.ociRegion);
                expect(io.mkdirP).toHaveBeenCalledWith(mockOciConfigDir);
                expect(fs.existsSync).toHaveBeenCalledWith(mockOciConfigDir);
                expect(fs.writeFileSync).toHaveBeenCalledWith(mockOciConfigFile, expect.any(String));
                expect(fs.writeFileSync).toHaveBeenCalledWith(mockOciPrivateKeyFile, expect.any(String));
                expect(fs.writeFileSync).toHaveBeenCalledWith(mockUpstTokenFile, mockTestData.upstToken);
            });
        });
        describe('error handling', () => {
            it('should throw an error if HOME environment variable is not defined', async () => {
                delete process.env.HOME;
                await expect((0, main_1.configureOciCli)(privateKey, publicKey, 'mockUpstToken', 'mockOciFingerprint', 'mockOciTenancy', 'mockOciRegion'))
                    .rejects
                    .toThrow('HOME environment variable is not defined');
            });
            it('should throw an error if OCI config directory cannot be created', async () => {
                io.mkdirP.mockResolvedValue(undefined);
                fs.existsSync.mockReturnValue(false);
                await expect((0, main_1.configureOciCli)(privateKey, publicKey, 'mockUpstToken', 'mockOciFingerprint', 'mockOciTenancy', 'mockOciRegion'))
                    .rejects
                    .toThrow('Unable to create OCI Config folder');
            });
            it('should handle file write permissions error', async () => {
                fs.writeFileSync.mockImplementation(() => {
                    throw new Error('Permission denied');
                });
                await expect((0, main_1.configureOciCli)(privateKey, publicKey, mockTestData.upstToken, mockTestData.ociFingerprint, mockTestData.ociTenancy, mockTestData.ociRegion)).rejects.toThrow('Failed to configure OCI CLI');
            });
            it('should handle directory creation failure', async () => {
                io.mkdirP.mockRejectedValue(new Error('Cannot create directory'));
                await expect((0, main_1.configureOciCli)(privateKey, publicKey, mockTestData.upstToken, mockTestData.ociFingerprint, mockTestData.ociTenancy, mockTestData.ociRegion)).rejects.toThrow('Failed to configure OCI CLI');
            });
        });
        describe('input validation', () => {
            it('should validate required parameters', async () => {
                await expect((0, main_1.configureOciCli)(privateKey, publicKey, '', mockTestData.ociFingerprint, mockTestData.ociTenancy, mockTestData.ociRegion)).rejects.toThrow('Invalid UPST token');
            });
        });
        describe('file system operations', () => {
            it('should set correct file permissions for private key', async () => {
                await (0, main_1.configureOciCli)(privateKey, publicKey, mockTestData.upstToken, mockTestData.ociFingerprint, mockTestData.ociTenancy, mockTestData.ociRegion);
                expect(fs.chmodSync).toHaveBeenCalledWith(path.join(mockTestData.home, 'private_key.pem'), '600');
            });
        });
    });
});
