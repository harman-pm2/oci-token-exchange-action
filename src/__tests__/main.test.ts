import { jest, expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { configureOciCli, OciConfig } from '../main';
import { Platform, PlatformLogger } from '../platforms/types';

// Properly mock fs/promises with correct return types
jest.mock('fs/promises', () => {
  const mockFs = {
    writeFile: jest.fn<() => Promise<void>>(),
    access: jest.fn<() => Promise<void>>(),
    mkdir: jest.fn<() => Promise<void>>(),
    chmod: jest.fn<() => Promise<void>>()
  };
  
  // Set up return values with proper typing
  mockFs.writeFile.mockResolvedValue(undefined);
  mockFs.access.mockResolvedValue(undefined);
  mockFs.mkdir.mockResolvedValue(undefined);
  mockFs.chmod.mockResolvedValue(undefined);
  
  return mockFs;
});

jest.mock('path', () => ({
  join: jest.fn((...segments) => segments.join('/'))
}));

class MockPlatform implements Platform {
  public readonly logger: PlatformLogger;

  constructor() {
    this.logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
      error: jest.fn()
    };
  }

  getInput = jest.fn<(name: string, required?: boolean) => string>();
  setOutput = jest.fn();
  setFailed = jest.fn();
  isDebug = jest.fn<() => boolean>().mockReturnValue(false);
  getOIDCToken = jest.fn<(audience: string) => Promise<string>>().mockResolvedValue('mock-token');
}

describe('main.ts', () => {
  let mockPlatform: MockPlatform;
  let testConfig: OciConfig;
  let testKeyPair: crypto.KeyPairSyncResult<string, string>;

  beforeEach(() => {
    mockPlatform = new MockPlatform();
    
    // Generate actual RSA keys for testing
    testKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    
    // Create proper RSA keys that will work with pkcs1 format
    testConfig = {
      privateKey: crypto.createPrivateKey(testKeyPair.privateKey),
      publicKey: crypto.createPublicKey(testKeyPair.publicKey),
      upstToken: 'test-token',
      ociFingerprint: 'test-fingerprint',
      ociTenancy: 'test-tenancy',
      ociRegion: 'test-region'
    };

    process.env.HOME = '/mock/home';
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
    delete process.env.HOME;
  });

  describe('configureOciCli', () => {
    it('should create OCI configuration successfully', async () => {
      await configureOciCli(mockPlatform, testConfig);

      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('.oci'), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(4);
      expect(fs.chmod).toHaveBeenCalledWith(expect.stringContaining('private_key.pem'), '600');
    });

    it('should throw error if HOME is undefined', async () => {
      delete process.env.HOME;
      await expect(configureOciCli(mockPlatform, testConfig)).rejects.toThrow('HOME environment variable is not defined');
    });

    it('should handle directory creation failure', async () => {
      const mkdirMock = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
      mkdirMock.mockRejectedValueOnce(new Error('Permission denied'));
      await expect(configureOciCli(mockPlatform, testConfig)).rejects.toThrow('Unable to create OCI Config folder');
    });

    it('should handle file write errors', async () => {
      const writeError = new Error('Write failed');
      (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockRejectedValueOnce(writeError);
      await expect(configureOciCli(mockPlatform, testConfig)).rejects.toThrow('Failed to write OCI configuration files');
    });

    it('should write correct OCI config content', async () => {
      await configureOciCli(mockPlatform, testConfig);
      // Verify that the config file (first fs.writeFile call) contains expected snippets.
      const fsWriteFileMock = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
      const configCall = fsWriteFileMock.mock.calls.find(call => typeof call[0] === 'string' && call[0].includes('config'));
      if (!configCall) {
        throw new Error('Config write call not found in mock calls');
      }
      expect(configCall[1]).toContain(`fingerprint=${testConfig.ociFingerprint}`);
      expect(configCall[1]).toContain(`tenancy=${testConfig.ociTenancy}`);
      expect(configCall[1]).toContain(`region=${testConfig.ociRegion}`);
    });
  });
});