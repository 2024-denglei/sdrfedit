/**
 * Pyodide Validator Service
 *
 * Provides sdrf-pipelines validation by running Python code in the browser
 * via Pyodide (WebAssembly). Uses a Web Worker to avoid blocking the UI.
 *
 * Also supports the EBI PRIDE SDRF Validator API as a remote validation backend.
 */

import { Injectable, signal, computed } from '@angular/core';
import { SdrfApiValidatorService, sdrfApiValidatorService } from './sdrf-api-validator.service';

/**
 * Validation error from sdrf-pipelines
 */
export interface ValidationError {
  message: string;
  row: number;  // 0-based, -1 if not applicable
  column: string | null;
  value: string | null;
  level: 'error' | 'warning';
  suggestion: string | null;
}

/**
 * Template column information
 */
export interface TemplateColumn {
  name: string;
  requirement: 'required' | 'recommended' | 'optional';
  description: string;
}

/**
 * Template details
 */
export interface TemplateDetails {
  name: string;
  description: string;
  version: string;
  extends: string | null;
  columns: TemplateColumn[];
}

/**
 * Service state
 */
export type PyodideState = 'not-loaded' | 'loading' | 'ready' | 'error';
export type ValidationBackendMode = 'api' | 'local' | 'auto';

interface ValidatorInitializeOptions {
  mode?: ValidationBackendMode;
  allowApiFallback?: boolean;
}

interface ValidatorRunOptions {
  skipOntology?: boolean;
  mode?: ValidationBackendMode;
  allowApiFallback?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PyodideValidatorService {
  private worker: Worker | null = null;
  private localValidatorReady = false;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();

  // API fallback service
  private apiValidator: SdrfApiValidatorService = sdrfApiValidatorService;

  // State signals
  readonly state = signal<PyodideState>('not-loaded');
  readonly loadProgress = signal<string>('');
  readonly availableTemplates = signal<string[]>([]);
  readonly lastError = signal<string | null>(null);

  // API fallback state
  readonly usingApiFallback = signal(false);
  readonly apiAvailable = signal<boolean | null>(null);

  // Computed signals
  readonly isReady = computed(() => this.state() === 'ready' || this.usingApiFallback());
  readonly isLoading = computed(() => this.state() === 'loading');

  /**
   * Initialize the requested validation backend.
   * Local mode downloads and loads Pyodide in the browser.
   * API mode checks the deployed PRIDE validator service and loads templates from it.
   */
  async initialize(options: ValidatorInitializeOptions = {}): Promise<void> {
    const mode = options.mode ?? 'api';
    const allowApiFallback =
      options.allowApiFallback ?? (mode === 'auto');

    if (mode === 'api') {
      await this.initializeApiMode();
      return;
    }

    if (mode === 'auto') {
      try {
        await this.initializeApiMode();
        return;
      } catch (apiError) {
        console.warn('API initialization failed, trying local validator:', apiError);
        await this.initializeLocalMode({ allowApiFallback });
        return;
      }
    }

    await this.initializeLocalMode({ allowApiFallback });
  }

  /**
   * Load list of available templates from the selected backend
   */
  private async loadTemplates(mode: 'api' | 'local'): Promise<void> {
    if (mode === 'api') {
      const templates = await this.apiValidator.getTemplates();
      this.availableTemplates.set(templates);
      return;
    }

    const templates = await this.sendMessage<string[]>('get-templates', {});
    this.availableTemplates.set(templates);
  }

  /**
   * Validate SDRF content against specified templates.
   */
  async validate(
    sdrfTsv: string,
    templates: string[],
    options: ValidatorRunOptions = {}
  ): Promise<ValidationError[]> {
    const mode = options.mode ?? 'api';
    const allowApiFallback =
      options.allowApiFallback ?? (mode === 'auto');

    if (mode === 'api') {
      return this.validateWithApi(sdrfTsv, templates, options);
    }

    if (mode === 'auto') {
      try {
        return await this.validateWithApi(sdrfTsv, templates, options);
      } catch (apiError) {
        console.warn('API validation failed, trying local validator:', apiError);
        return this.validateLocally(sdrfTsv, templates, options, allowApiFallback);
      }
    }

    return this.validateLocally(sdrfTsv, templates, options, allowApiFallback);
  }

  /**
   * Validate using the API as a fallback
   */
  private async validateWithApi(
    sdrfTsv: string,
    templates: string[],
    options: ValidatorRunOptions = {}
  ): Promise<ValidationError[]> {
    await this.ensureApiAvailable();

    console.log('Using SDRF Validator API for validation');
    this.loadProgress.set('Using SDRF Validator API...');

    const errors = await this.apiValidator.validate(sdrfTsv, templates, {
      skipOntology: options.skipOntology ?? true,
    });

    this.loadProgress.set('Validation complete (via API)');
    return errors;
  }

  /**
   * Get details about a specific template
   */
  async getTemplateDetails(templateName: string): Promise<TemplateDetails | null> {
    if (this.usingApiFallback() || this.state() !== 'ready') {
      throw new Error('Pyodide not initialized. Call initialize() first.');
    }

    return this.sendMessage<TemplateDetails | null>('get-template-details', {
      template: templateName
    });
  }

  /**
   * Get recommended templates based on SDRF content
   */
  detectTemplates(sdrfTsv: string): string[] {
    const templates: string[] = ['ms-proteomics'];
    const content = sdrfTsv.toLowerCase();

    // Check for organism
    if (content.includes('homo sapiens')) {
      templates.push('human');
    } else if (
      content.includes('mus musculus') ||
      content.includes('rattus') ||
      content.includes('danio rerio')
    ) {
      templates.push('vertebrates');
    } else if (
      content.includes('drosophila') ||
      content.includes('caenorhabditis')
    ) {
      templates.push('invertebrates');
    } else if (
      content.includes('arabidopsis') ||
      content.includes('zea mays')
    ) {
      templates.push('plants');
    }

    // Check for cell lines
    if (
      content.includes('characteristics[cell line]') ||
      content.includes('cvcl_')
    ) {
      templates.push('cell-lines');
    }

    return templates;
  }

  /**
   * Send a message to the worker and wait for response
   */
  private sendMessage<T>(type: string, payload: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = ++this.messageId;
      this.pendingRequests.set(id, { resolve, reject });

      this.worker.postMessage({ type, payload, id });

      // Timeout after 5 minutes for long operations
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 300000);
    });
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const { type, payload, id } = event.data;

    // Handle responses to pending requests
    if (id !== undefined && this.pendingRequests.has(id)) {
      const { resolve, reject } = this.pendingRequests.get(id)!;
      this.pendingRequests.delete(id);

      if (type === 'error') {
        reject(new Error(payload));
      } else {
        resolve(payload);
      }
      return;
    }

    // Handle broadcast messages
    switch (type) {
      case 'progress':
        this.loadProgress.set(payload);
        break;
      case 'templates':
        this.availableTemplates.set(payload);
        break;
      case 'error':
        console.error('Pyodide worker error:', payload);
        this.lastError.set(payload);
        break;
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Pyodide worker error:', error);
    this.localValidatorReady = false;
    this.lastError.set(error.message || 'Unknown worker error');
    this.state.set('error');
  }

  /**
   * Terminate the worker and clean up
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.localValidatorReady = false;
    this.usingApiFallback.set(false);
    this.apiAvailable.set(null);
    this.availableTemplates.set([]);
    this.state.set('not-loaded');
    this.pendingRequests.clear();
  }

  private async initializeApiMode(): Promise<void> {
    this.state.set('loading');
    this.usingApiFallback.set(false);
    this.lastError.set(null);
    this.loadProgress.set('Checking SDRF Validator API...');

    try {
      await this.ensureApiAvailable();
      this.usingApiFallback.set(true);
      this.state.set(this.localValidatorReady ? 'ready' : 'not-loaded');
      this.loadProgress.set('Using SDRF Validator API');
      await this.loadTemplates('api');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.state.set('error');
      this.lastError.set(errorMessage);
      this.loadProgress.set(`Error: ${errorMessage}`);
      throw error;
    }
  }

  private async initializeLocalMode(
    options: { allowApiFallback?: boolean } = {}
  ): Promise<void> {
    const allowApiFallback = options.allowApiFallback ?? false;

    if (this.localValidatorReady) {
      this.usingApiFallback.set(false);
      this.state.set('ready');
      this.loadProgress.set('Ready');
      await this.loadTemplates('local');
      return;
    }

    if (this.state() === 'loading' && !this.usingApiFallback()) {
      return this.waitForLocalInitialization();
    }

    this.usingApiFallback.set(false);
    this.state.set('loading');
    this.loadProgress.set('Creating worker...');
    this.lastError.set(null);

    try {
      if (!this.worker) {
        this.worker = new Worker(
          new URL('../../workers/pyodide.worker', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event) => this.handleWorkerMessage(event);
        this.worker.onerror = (error) => this.handleWorkerError(error);
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Pyodide initialization timed out (60s)'));
        }, 60000);

        const readyHandler = (event: MessageEvent) => {
          const { type, payload } = event.data;

          if (type === 'progress') {
            this.loadProgress.set(payload);
          } else if (type === 'ready') {
            clearTimeout(timeout);
            this.worker?.removeEventListener('message', readyHandler);
            resolve();
          } else if (type === 'error') {
            clearTimeout(timeout);
            this.worker?.removeEventListener('message', readyHandler);
            reject(new Error(payload));
          }
        };

        this.worker?.addEventListener('message', readyHandler);
        this.worker?.postMessage({ type: 'init' });
      });

      this.state.set('ready');
      this.localValidatorReady = true;
      this.loadProgress.set('Ready');
      await this.loadTemplates('local');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Pyodide initialization failed:', errorMessage);
      this.localValidatorReady = false;

      if (allowApiFallback) {
        console.log('Attempting to use SDRF Validator API as fallback...');
        try {
          await this.initializeApiMode();
          this.lastError.set(`Pyodide failed: ${errorMessage}. Using API fallback.`);
          return;
        } catch (apiError) {
          console.warn('API fallback also failed:', apiError);
        }
      }

      this.state.set('error');
      this.lastError.set(errorMessage);
      this.loadProgress.set(`Error: ${errorMessage}`);
      throw error;
    }
  }

  private async validateLocally(
    sdrfTsv: string,
    templates: string[],
    options: ValidatorRunOptions,
    allowApiFallback: boolean
  ): Promise<ValidationError[]> {
    if (this.usingApiFallback() || this.state() !== 'ready') {
      await this.initializeLocalMode({ allowApiFallback });
    }

    try {
      return await this.sendMessage<ValidationError[]>('validate', {
        sdrf: sdrfTsv,
        templates,
        skipOntology: options.skipOntology ?? true
      });
    } catch (error) {
      if (!allowApiFallback) {
        throw error;
      }

      console.warn('Pyodide validation failed, falling back to API:', error);
      return this.validateWithApi(sdrfTsv, templates, options);
    }
  }

  private async ensureApiAvailable(): Promise<void> {
    const apiHealthy = await this.apiValidator.checkHealth();
    this.apiAvailable.set(apiHealthy);

    if (!apiHealthy) {
      throw new Error('SDRF Validator API is not available');
    }
  }

  private waitForLocalInitialization(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkReady = setInterval(() => {
        if (this.state() === 'ready' && !this.usingApiFallback()) {
          clearInterval(checkReady);
          resolve();
        } else if (this.state() === 'error') {
          clearInterval(checkReady);
          reject(new Error(this.lastError() || 'Initialization failed'));
        }
      }, 100);
    });
  }
}

// Export singleton instance
export const pyodideValidatorService = new PyodideValidatorService();
