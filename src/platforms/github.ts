/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import * as core from '@actions/core';
import { Platform, PlatformLogger } from './types';

export class GitHubPlatform implements Platform {
  private readonly _logger: PlatformLogger = {
    debug: (message: string) => core.debug(message),
    info: (message: string) => core.info(message),
    warning: (message: string) => core.warning(message),
    error: (message: string) => core.error(message)
  };

  getInput(name: string, required = false): string {
    return core.getInput(name, { required });
  }

  setOutput(name: string, value: string): void {
    core.setOutput(name, value);
  }

  setFailed(message: string): void {
    core.setFailed(message);
  }

  isDebug(): boolean {
    return core.isDebug();
  }

  async getOIDCToken(audience: string): Promise<string> {
    const token = await core.getIDToken(audience);
    if (!token) {
      throw new Error('Failed to get OIDC token from GitHub Actions');
    }
    return token;
  }

  get logger(): PlatformLogger {
    return this._logger;
  }
}