import * as io from '@actions/io';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { configureOciCli } from '../main'; // Adjust the import path as needed

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

      (io.mkdirP as jest.Mock).mockResolvedValue(undefined);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      const upstToken = 'mockUpstToken';
      const ociUser = 'mockOciUser';
      const ociFingerprint = 'mockOciFingerprint';
      const ociTenancy = 'mockOciTenancy';
      const ociRegion = 'mockOciRegion';

      await configureOciCli(privateKey, publicKey, upstToken, ociUser, ociFingerprint, ociTenancy, ociRegion);

      expect(io.mkdirP).toHaveBeenCalledWith(mockOciConfigDir);
      expect(fs.existsSync).toHaveBeenCalledWith(mockOciConfigDir);
      expect(fs.writeFileSync).toHaveBeenCalledWith(mockOciConfigFile, expect.any(String));
      expect(fs.writeFileSync).toHaveBeenCalledWith(mockOciPrivateKeyFile, expect.any(String));
      expect(fs.writeFileSync).toHaveBeenCalledWith(mockUpstTokenFile, upstToken);
    });

    it('should throw an error if HOME environment variable is not defined', async () => {
      delete process.env.HOME;

      await expect(configureOciCli(privateKey, publicKey, 'mockUpstToken', 'mockOciUser', 'mockOciFingerprint', 'mockOciTenancy', 'mockOciRegion'))
        .rejects
        .toThrow('HOME environment variable is not defined');
    });

    it('should throw an error if OCI config directory cannot be created', async () => {
      const mockHome = '/mock/home';
      process.env.HOME = mockHome;

      (io.mkdirP as jest.Mock).mockResolvedValue(undefined);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(configureOciCli(privateKey, publicKey, 'mockUpstToken', 'mockOciUser', 'mockOciFingerprint', 'mockOciTenancy', 'mockOciRegion'))
        .rejects
        .toThrow('Unable to create OCI Config folder');
    });
  });
});