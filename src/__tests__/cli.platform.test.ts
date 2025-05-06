import { jest, expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import { CLIPlatform } from '../platforms/cli';
import { PlatformConfig } from '../platforms/types';

describe('CLIPlatform', () => {
  let mockConfig: PlatformConfig;
  let platform: CLIPlatform;
  
  beforeEach(() => {
    // Reset environment before each test
    process.env = {};
    
    mockConfig = {
      audience: 'test-audience',
      tokenEnvVar: 'TEST_TOKEN_VAR'
    };
    
    platform = new CLIPlatform(mockConfig);
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getInput', () => {
    it('should retrieve value from direct environment variable', () => {
      process.env.TEST_INPUT = 'test-value';
      expect(platform.getInput('test_input')).toBe('test-value');
    });

    it('should retrieve value from INPUT_ prefixed variable', () => {
      process.env.INPUT_TEST_INPUT = 'test-value-input';
      expect(platform.getInput('test_input')).toBe('test-value-input');
    });

    it('should retrieve value from OCI_ prefixed variable', () => {
      process.env.OCI_TEST_INPUT = 'test-value-oci';
      expect(platform.getInput('test_input')).toBe('test-value-oci');
    });

    it('should retrieve value from OIDC_ prefixed variable', () => {
      process.env.OIDC_TEST_INPUT = 'test-value-oidc';
      expect(platform.getInput('test_input')).toBe('test-value-oidc');
    });

    it('should prioritize direct environment variable over prefixed ones', () => {
      process.env.TEST_INPUT = 'direct-value';
      process.env.INPUT_TEST_INPUT = 'input-value';
      process.env.OCI_TEST_INPUT = 'oci-value';
      expect(platform.getInput('test_input')).toBe('direct-value');
    });

    it('should return empty string when variable is not found and not required', () => {
      expect(platform.getInput('non_existing')).toBe('');
    });

    it('should throw error when required variable is not found', () => {
      expect(() => platform.getInput('required_input', true)).toThrow('Input required and not supplied: required_input');
    });

    // Tests for oci_home input handling
    it('should retrieve value from OCI_HOME environment variable', () => {
      process.env.OCI_HOME = '/custom/home';
      expect(platform.getInput('oci_home')).toBe('/custom/home');
    });

    it('should retrieve value from INPUT_OCI_HOME prefixed variable', () => {
      process.env.INPUT_OCI_HOME = '/input/home';
      expect(platform.getInput('oci_home')).toBe('/input/home');
    });

    it('should prioritize OCI_HOME over INPUT_OCI_HOME', () => {
      process.env.OCI_HOME = '/direct';
      process.env.INPUT_OCI_HOME = '/input';
      expect(platform.getInput('oci_home')).toBe('/direct');
    });

    it('should throw error when oci_home is required and not supplied', () => {
      expect(() => platform.getInput('oci_home', true)).toThrow('Input required and not supplied: oci_home');
    });
  });

  describe('getOIDCToken', () => {
    it('should return token from configured environment variable', async () => {
      process.env.TEST_TOKEN_VAR = 'test-token-value';
      const token = await platform.getOIDCToken('test-audience');
      expect(token).toBe('test-token-value');
    });

    it('should throw error when token environment variable is not set', async () => {
      await expect(platform.getOIDCToken('test-audience')).rejects.toThrow('TEST_TOKEN_VAR environment variable not found');
    });
  });

  describe('isDebug', () => {
    it('should return true when DEBUG=true', () => {
      process.env.DEBUG = 'true';
      expect(platform.isDebug()).toBe(true);
    });

    it('should return false when DEBUG is not set', () => {
      expect(platform.isDebug()).toBe(false);
    });

    it('should return false when DEBUG has any other value', () => {
      process.env.DEBUG = 'yes';
      expect(platform.isDebug()).toBe(false);
    });
  });
});
