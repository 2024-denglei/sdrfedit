/**
 * SDRF API Validator Service
 *
 * Provides SDRF validation using the EBI PRIDE SDRF Validator API.
 *
 * API Documentation: https://www.ebi.ac.uk/pride/services/sdrf-validator/docs
 */

import { signal } from '@angular/core';
import { ValidationError } from './pyodide-validator.service';

/**
 * API validation error from the SDRF Validator API
 */
export interface ApiValidationError {
  message: string;
  type?: string;
  error_type?: string;
  row?: number;
  column?: string;
  value?: string;
}

/**
 * API validation result from the SDRF Validator API
 */
export interface ApiValidationResult {
  valid: boolean;
  errors: ApiValidationError[];
  warnings: ApiValidationError[];
  error_count: number;
  warning_count: number;
  templates_used: string[];
  sdrf_pipelines_version: string;
}

/**
 * Template info from API
 */
export interface ApiTemplateInfo {
  name: string;
  description: string;
}

/**
 * API templates response
 */
export interface ApiTemplatesResponse {
  templates: ApiTemplateInfo[];
  legacy_mappings: Record<string, string>;
}

/**
 * API health response
 */
export interface ApiHealthResponse {
  status: string;
  sdrf_pipelines_version: string;
  ontology_validation_available: boolean;
}

const API_BASE_URL = 'https://www.ebi.ac.uk/pride/services/sdrf-validator';
const DEFAULT_TEMPLATES = [
  'ms-proteomics',
  'human',
  'vertebrates',
  'invertebrates',
  'plants',
  'cell-lines',
];
const TEMPLATE_ALIASES: Record<string, string> = {
  default: 'ms-proteomics',
  'cell_lines': 'cell-lines',
  'cell-line': 'cell-lines',
  'nonvertebrates': 'invertebrates',
};

export class SdrfApiValidatorService {
  readonly isAvailable = signal<boolean | null>(null);
  readonly lastError = signal<string | null>(null);
  readonly apiVersion = signal<string | null>(null);

  /**
   * Check if the API is available and healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        this.isAvailable.set(false);
        return false;
      }

      const health: ApiHealthResponse = await response.json();
      this.isAvailable.set(health.status === 'healthy');
      this.apiVersion.set(health.sdrf_pipelines_version);
      return health.status === 'healthy';
    } catch (error) {
      console.warn('SDRF API health check failed:', error);
      this.isAvailable.set(false);
      this.lastError.set(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Get available validation templates from the API
   */
  async getTemplates(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/templates`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get templates: ${response.status}`);
      }

      const result: ApiTemplatesResponse = await response.json();
      const canonicalTemplates = result.templates.map((template) =>
        this.normalizeTemplateName(template.name)
      );
      return Array.from(new Set(canonicalTemplates));
    } catch (error) {
      console.warn('Failed to get templates from API:', error);
      return DEFAULT_TEMPLATES;
    }
  }

  /**
   * Validate SDRF content using the API
   *
   * @param sdrfTsv - The SDRF content as TSV text
   * @param templates - Templates to validate against
   * @param options - Validation options
   * @returns Array of validation errors
   */
  async validate(
    sdrfTsv: string,
    templates: string[] = ['ms-proteomics'],
    options: { skipOntology?: boolean; useOlsCacheOnly?: boolean } = {}
  ): Promise<ValidationError[]> {
    const { skipOntology = true, useOlsCacheOnly = true } = options;
    const normalizedTemplates = this.normalizeTemplates(templates);

    try {
      // Build query parameters (no content - sent via FormData)
      const params = new URLSearchParams();
      normalizedTemplates.forEach(t => params.append('template', t));
      params.append('skip_ontology', String(skipOntology));
      params.append('use_ols_cache_only', String(useOlsCacheOnly));

      // Convert text content to a File blob for multipart upload
      const blob = new Blob([sdrfTsv], { type: 'text/tab-separated-values' });
      const file = new File([blob], 'sdrf.tsv', { type: 'text/tab-separated-values' });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/validate?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Validation API error: ${response.status} - ${errorText}`);
      }

      const result: ApiValidationResult = await response.json();

      // Convert API errors to our ValidationError format
      const errors = this.convertApiErrors(result.errors, 'error');
      const warnings = this.convertApiErrors(result.warnings, 'warning');

      return [...errors, ...warnings];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastError.set(errorMessage);
      throw new Error(`SDRF API validation failed: ${errorMessage}`);
    }
  }

  /**
   * Validate SDRF file using multipart upload
   *
   * @param file - The SDRF file to validate
   * @param templates - Templates to validate against
   * @param options - Validation options
   * @returns Array of validation errors
   */
  async validateFile(
    file: File,
    templates: string[] = ['ms-proteomics'],
    options: { skipOntology?: boolean; useOlsCacheOnly?: boolean } = {}
  ): Promise<ValidationError[]> {
    const { skipOntology = true, useOlsCacheOnly = true } = options;
    const normalizedTemplates = this.normalizeTemplates(templates);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      normalizedTemplates.forEach(t => params.append('template', t));
      params.append('skip_ontology', String(skipOntology));
      params.append('use_ols_cache_only', String(useOlsCacheOnly));

      // Create form data with file
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/validate?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Validation API error: ${response.status} - ${errorText}`);
      }

      const result: ApiValidationResult = await response.json();

      // Convert API errors to our ValidationError format
      const errors = this.convertApiErrors(result.errors, 'error');
      const warnings = this.convertApiErrors(result.warnings, 'warning');

      return [...errors, ...warnings];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastError.set(errorMessage);
      throw new Error(`SDRF API validation failed: ${errorMessage}`);
    }
  }

  /**
   * Convert API error format to our internal ValidationError format
   */
  private convertApiErrors(
    apiErrors: ApiValidationError[],
    level: 'error' | 'warning'
  ): ValidationError[] {
    return apiErrors.map(err => ({
      message: err.message,
      row: err.row ?? -1,
      column: err.column ?? null,
      value: err.value ?? null,
      level,
      suggestion: this.generateSuggestion(err),
    }));
  }

  /**
   * Generate a suggestion based on the error type
   */
  private generateSuggestion(error: ApiValidationError): string | null {
    const errorType = (error.error_type || error.type || '').toLowerCase();
    const message = error.message?.toLowerCase() || '';

    // Common error patterns and suggestions
    if (errorType.includes('missing') || message.includes('missing')) {
      if (error.column) {
        return `Add a value for the "${error.column}" column`;
      }
      return 'Add the missing required value';
    }

    if (errorType.includes('ontology') || message.includes('ontology')) {
      return 'Use a valid ontology term from the appropriate ontology (e.g., EFO, NCBI Taxonomy)';
    }

    if (errorType.includes('format') || message.includes('format')) {
      return 'Check the value format and ensure it matches the expected pattern';
    }

    if (errorType.includes('duplicate') || message.includes('duplicate')) {
      return 'Remove or rename duplicate entries';
    }

    if (message.includes('not allowed') || message.includes('invalid')) {
      return 'Check the allowed values for this column';
    }

    return null;
  }

  private normalizeTemplates(templates: string[]): string[] {
    const canonicalTemplates = templates.map((template) =>
      this.normalizeTemplateName(template)
    );
    return Array.from(new Set(canonicalTemplates));
  }

  private normalizeTemplateName(templateName: string): string {
    return TEMPLATE_ALIASES[templateName] || templateName;
  }
}

// Export singleton instance
export const sdrfApiValidatorService = new SdrfApiValidatorService();
