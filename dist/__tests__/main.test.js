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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
        it('should configure OCI CLI with the UPST token', async () => {
            const mockHome = '/mock/home';
            process.env.HOME = mockHome;
            const mockOciConfigDir = path.join(mockHome, '.oci');
            const mockOciConfigFile = path.join(mockOciConfigDir, 'config');
            const mockOciPrivateKeyFile = path.join(mockHome, 'private_key.pem');
            const mockOciPublicKeyFile = path.join(mockHome, 'public_key.pem');
            const mockUpstTokenFile = path.join(mockHome, 'session');
            io.mkdirP.mockResolvedValue(undefined);
            fs.existsSync.mockReturnValue(true);
            fs.writeFileSync.mockImplementation(() => { });
            const upstToken = 'mockUpstToken';
            const ociUser = 'mockOciUser';
            const ociFingerprint = 'mockOciFingerprint';
            const ociTenancy = 'mockOciTenancy';
            const ociRegion = 'mockOciRegion';
            await (0, main_1.configureOciCli)(privateKey, publicKey, upstToken, ociUser, ociFingerprint, ociTenancy, ociRegion);
            expect(io.mkdirP).toHaveBeenCalledWith(mockOciConfigDir);
            expect(fs.existsSync).toHaveBeenCalledWith(mockOciConfigDir);
            expect(fs.writeFileSync).toHaveBeenCalledWith(mockOciConfigFile, expect.any(String));
            expect(fs.writeFileSync).toHaveBeenCalledWith(mockOciPrivateKeyFile, expect.any(String));
            expect(fs.writeFileSync).toHaveBeenCalledWith(mockUpstTokenFile, upstToken);
        });
        it('should throw an error if HOME environment variable is not defined', async () => {
            delete process.env.HOME;
            await expect((0, main_1.configureOciCli)(privateKey, publicKey, 'mockUpstToken', 'mockOciUser', 'mockOciFingerprint', 'mockOciTenancy', 'mockOciRegion'))
                .rejects
                .toThrow('HOME environment variable is not defined');
        });
        it('should throw an error if OCI config directory cannot be created', async () => {
            const mockHome = '/mock/home';
            process.env.HOME = mockHome;
            io.mkdirP.mockResolvedValue(undefined);
            fs.existsSync.mockReturnValue(false);
            await expect((0, main_1.configureOciCli)(privateKey, publicKey, 'mockUpstToken', 'mockOciUser', 'mockOciFingerprint', 'mockOciTenancy', 'mockOciRegion'))
                .rejects
                .toThrow('Unable to create OCI Config folder');
        });
    });
});
