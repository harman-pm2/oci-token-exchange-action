import { jest, expect, describe, it, beforeEach } from '@jest/globals';
import axios from 'axios';
import { TokenExchangeConfig, TokenExchangeError, tokenExchangeJwtToUpst } from '../main';
import * as crypto from 'crypto';
import { Platform, PlatformLogger } from '../platforms/types';

// Mock axios
jest.mock('axios');

// Don't mock the whole module, just mock the delay function directly since we're testing tokenExchangeJwtToUpst
// This avoids TypeScript errors from the mocking approach
jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
  callback();
  return {} as any;
});

// Create a mock platform implementation
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

describe('tokenExchangeJwtToUpst', () => {
  let mockPlatform: MockPlatform;
  let testConfig: TokenExchangeConfig;
  
  beforeEach(() => {
    mockPlatform = new MockPlatform();
    
    // Generate a public key for testing
    const { publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });
    
    // Export the public key as base64 for the test
    const publicKeyDer = crypto.createPublicKey(publicKey).export({ 
      type: 'spki', format: 'der' 
    }).toString('base64');
    
    testConfig = {
      tokenExchangeURL: 'https://test.oracle.com/oauth2/v1/token',
      clientCred: 'dGVzdC1jbGllbnQtaWQ=', // Base64 encoded test client ID
      ociPublicKey: publicKeyDer,
      subjectToken: 'test-jwt-token',
      retryCount: 3
    };

    // Reset axios mocks
    jest.clearAllMocks();
    (axios.post as jest.MockedFunction<typeof axios.post>).mockReset();
  });

  it('should successfully exchange JWT for UPST', async () => {
    // Setup axios mock to return a successful response
    (axios.post as jest.MockedFunction<typeof axios.post>)
      .mockResolvedValueOnce({
        data: { token: 'mocked-upst-token' }
      });

    // Call the function
    const result = await tokenExchangeJwtToUpst(mockPlatform, testConfig);

    // Verify results
    expect(result).toEqual({ token: 'mocked-upst-token' });
    
    // Check that axios was called with the right parameters
    expect(axios.post).toHaveBeenCalledWith(
      testConfig.tokenExchangeURL,
      {
        'grant_type': 'urn:ietf:params:oauth:grant-type:token-exchange',
        'requested_token_type': 'urn:oci:token-type:oci-upst',
        'public_key': testConfig.ociPublicKey,
        'subject_token': testConfig.subjectToken,
        'subject_token_type': 'jwt'
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${testConfig.clientCred}`
        }
      }
    );

    // Verify log calls
    expect(mockPlatform.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Token Exchange Request Data'));
    expect(mockPlatform.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Token Exchange Response'));
  });

  it('should retry on failure if retries are available', async () => {
    // Setup axios mock to fail on first call then succeed
    (axios.post as jest.MockedFunction<typeof axios.post>)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        data: { token: 'mocked-upst-token-after-retry' }
      });

    // Call the function
    const result = await tokenExchangeJwtToUpst(mockPlatform, testConfig);

    // Verify results
    expect(result).toEqual({ token: 'mocked-upst-token-after-retry' });
    
    // Check that axios was called twice
    expect(axios.post).toHaveBeenCalledTimes(2);
    
    // Verify log warning for retry
    expect(mockPlatform.logger.warning).toHaveBeenCalledWith(expect.stringContaining('retrying'));
  });

  // Simplify test cases to avoid timeouts
  it('should throw TokenExchangeError after exhausting retries', async () => {
    // Setup axios to fail with a simple error
    const mockError = new Error('Network error');
    (axios.post as jest.MockedFunction<typeof axios.post>).mockRejectedValue(mockError);
    
    // Test with minimal retry count to speed up test
    const quickTestConfig = {
      ...testConfig,
      retryCount: 1  // Use fewer retries to avoid timeout
    };

    // Expect rejection with TokenExchangeError
    await expect(tokenExchangeJwtToUpst(mockPlatform, quickTestConfig))
      .rejects.toThrow(TokenExchangeError);
  });

  it('should include the original error message in TokenExchangeError', async () => {
    // Setup axios with specific error message
    const mockError = new Error('API rate limit exceeded');
    (axios.post as jest.MockedFunction<typeof axios.post>).mockRejectedValue(mockError);
    
    // Test with zero retries to avoid delays
    const noRetryConfig = {
      ...testConfig,
      retryCount: 0
    };

    // Test for specific error message
    await expect(tokenExchangeJwtToUpst(mockPlatform, noRetryConfig))
      .rejects.toThrow(/API rate limit exceeded/);
  });
});
