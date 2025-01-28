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

        (io.mkdirP as jest.Mock).mockResolvedValue(undefined);
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

        await configureOciCli(privateKey, publicKey, mockTestData.upstToken, mockTestData.ociFingerprint, mockTestData.ociTenancy, mockTestData.ociRegion);

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

        await expect(configureOciCli(privateKey, publicKey, 'mockUpstToken', 'mockOciFingerprint', 'mockOciTenancy', 'mockOciRegion'))
          .rejects
          .toThrow('HOME environment variable is not defined');
      });

      it('should throw an error if OCI config directory cannot be created', async () => {
        (io.mkdirP as jest.Mock).mockResolvedValue(undefined);
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        await expect(configureOciCli(privateKey, publicKey, 'mockUpstToken', 'mockOciFingerprint', 'mockOciTenancy', 'mockOciRegion'))
          .rejects
          .toThrow('Unable to create OCI Config folder');
      });

      it('should handle file write permissions error', async () => {
        (fs.writeFileSync as jest.Mock).mockImplementation(() => {
          throw new Error('Permission denied');
        });

        await expect(configureOciCli(
          privateKey,
          publicKey,
          mockTestData.upstToken,
          mockTestData.ociFingerprint,
          mockTestData.ociTenancy,
          mockTestData.ociRegion
        )).rejects.toThrow('Failed to configure OCI CLI');
      });

      it('should handle directory creation failure', async () => {
        (io.mkdirP as jest.Mock).mockRejectedValue(new Error('Cannot create directory'));

        await expect(configureOciCli(
          privateKey,
          publicKey,
          mockTestData.upstToken,
          mockTestData.ociFingerprint,
          mockTestData.ociTenancy,
          mockTestData.ociRegion
        )).rejects.toThrow('Failed to configure OCI CLI');
      });
    });

    describe('input validation', () => {
      it('should validate required parameters', async () => {
        await expect(configureOciCli(
          privateKey,
          publicKey,
          '',
          mockTestData.ociFingerprint,
          mockTestData.ociTenancy,
          mockTestData.ociRegion
        )).rejects.toThrow('Invalid UPST token');
      });
    });

    describe('file system operations', () => {
      it('should set correct file permissions for private key', async () => {
        await configureOciCli(
          privateKey,
          publicKey,
          mockTestData.upstToken,
          mockTestData.ociFingerprint,
          mockTestData.ociTenancy,
          mockTestData.ociRegion
        );

        expect(fs.chmodSync).toHaveBeenCalledWith(
          path.join(mockTestData.home, 'private_key.pem'),
          '600'
        );
      });
    });
  });
});