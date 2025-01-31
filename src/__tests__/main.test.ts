import { jest, expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { configureOciCli, OciConfig } from '../main';
import { Platform, PlatformLogger } from '../platforms/types';

jest.mock('fs/promises');
jest.mock('path');

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

  beforeEach(() => {
    mockPlatform = new MockPlatform();
    global.platform = mockPlatform;

    // Create test keys
    const testKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });

    testConfig = {
      privateKey: testKeyPair.privateKey,
      publicKey: testKeyPair.publicKey,
      upstToken: 'test-token',
      ociFingerprint: 'test-fingerprint',
      ociTenancy: 'test-tenancy',
      ociRegion: 'test-region'
    };

    process.env.HOME = '/mock/home';
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.HOME;
    delete global.platform;
  });

  describe('configureOciCli', () => {
    it('should create OCI configuration successfully', async () => {
      await configureOciCli(testConfig);

      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('.oci'), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(4);
      expect(fs.chmod).toHaveBeenCalledWith(expect.stringContaining('private_key.pem'), '600');
    });

    it('should handle missing HOME environment', async () => {
      delete process.env.HOME;
      await expect(configureOciCli(testConfig)).rejects.toThrow('HOME environment variable is not defined');
    });

    it('should handle directory creation failure', async () => {
      const mkdirMock = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
      mkdirMock.mockRejectedValueOnce(new Error('Permission denied'));
      await expect(configureOciCli(testConfig)).rejects.toThrow('Unable to create OCI Config folder');
    });

    it('should handle file write errors', async () => {
      (fs.writeFile as jest.MockedFunction<typeof fs.writeFile>).mockRejectedValueOnce(new Error('Write failed'));
      await expect(configureOciCli(testConfig)).rejects.toThrow('Failed to write OCI configuration files');
    });
  });
});