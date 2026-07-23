/**
 * Factor Values Component (Step 7)
 *
 * Select experimental factor columns to include in the generated SDRF.
 */

import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { WizardStateService } from '../../../core/services/wizard-state.service';
import { WizardFactor } from '../../../core/models/wizard';

const CHARACTERISTIC_OPTIONS: { id: string; label: string }[] = [
  { id: 'disease', label: 'disease' },
  { id: 'organism part', label: 'organism part' },
  { id: 'sex', label: 'sex' },
  { id: 'age', label: 'age' },
  { id: '', label: 'Custom (manual default)' },
];

@Component({
  selector: 'wizard-factor-values',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step-container">
      <div class="step-header">
        <h3>Factor Values</h3>
        <p class="step-description">
          Define experimental variables as <code>factor value[...]</code> columns.
          Values are copied from matching characteristics by default.
        </p>
      </div>

      <div class="info-banner">
        <span class="info-icon">i</span>
        <div class="info-content">
          <strong>Why factors?</strong>
          <p>
            SDRF requires factor columns for the variables you analyse
            (e.g. disease vs normal). At least one enabled factor is required.
          </p>
        </div>
      </div>

      <div class="factors-list">
        @for (factor of wizardState.factors(); track $index; let i = $index) {
          <div class="factor-row" [class.disabled]="!factor.enabled">
            <label class="enable-toggle">
              <input
                type="checkbox"
                [ngModel]="factor.enabled"
                (ngModelChange)="wizardState.toggleFactor(i, $event)"
              />
            </label>

            <div class="factor-fields">
              <div class="field">
                <label>Factor name</label>
                <div class="name-input-row">
                  <span class="prefix">factor value[</span>
                  <input
                    type="text"
                    class="form-input"
                    [ngModel]="factor.name"
                    (ngModelChange)="onNameChange(i, $event)"
                    placeholder="disease"
                  />
                  <span class="suffix">]</span>
                </div>
              </div>

              <div class="field">
                <label>Copy values from</label>
                <select
                  class="form-input"
                  [ngModel]="factor.sourceCharacteristic ?? ''"
                  (ngModelChange)="onSourceChange(i, $event)"
                >
                  @for (opt of characteristicOptions; track opt.id) {
                    <option [value]="opt.id">{{ opt.label }}</option>
                  }
                </select>
              </div>

              @if (!factor.sourceCharacteristic) {
                <div class="field">
                  <label>Default value</label>
                  <input
                    type="text"
                    class="form-input"
                    [ngModel]="factor.defaultValue"
                    (ngModelChange)="wizardState.updateFactor(i, { defaultValue: $event })"
                    placeholder="not available"
                  />
                </div>
              }
            </div>

            <button
              class="btn-remove"
              (click)="wizardState.removeFactor(i)"
              [disabled]="wizardState.factors().length <= 1"
              title="Remove factor"
            >
              &times;
            </button>
          </div>
        }
      </div>

      <button class="btn-add" (click)="addCustomFactor()">
        + Add factor
      </button>

      @if (!wizardState.isStep7Valid()) {
        <div class="validation-message">
          <span class="warning-icon">!</span>
          Enable at least one factor with a non-empty name to continue.
        </div>
      }
    </div>
  `,
  styles: [`
    .step-container {
      max-width: 700px;
    }

    .step-header {
      margin-bottom: 20px;
    }

    .step-header h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }

    .step-description {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }

    .step-description code {
      background: #f3f4f6;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 12px;
    }

    .info-banner {
      display: flex;
      gap: 12px;
      padding: 14px 16px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      margin-bottom: 20px;
    }

    .info-icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #3b82f6;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .info-content strong {
      font-size: 13px;
      color: #1e40af;
    }

    .info-content p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #1e3a8a;
    }

    .factors-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }

    .factor-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: white;
    }

    .factor-row.disabled {
      opacity: 0.55;
      background: #f9fafb;
    }

    .enable-toggle {
      padding-top: 28px;
    }

    .factor-fields {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field label {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
    }

    .name-input-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .prefix, .suffix {
      font-size: 12px;
      color: #9ca3af;
      font-family: ui-monospace, monospace;
      white-space: nowrap;
    }

    .form-input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
    }

    .form-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    .btn-remove {
      margin-top: 24px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 8px;
      background: #fee2e2;
      color: #b91c1c;
      font-size: 18px;
      cursor: pointer;
    }

    .btn-remove:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-add {
      border: 1px dashed #93c5fd;
      background: #eff6ff;
      color: #1d4ed8;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
    }

    .btn-add:hover {
      background: #dbeafe;
    }

    .validation-message {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px 14px;
      background: #fef3c7;
      color: #92400e;
      border-radius: 8px;
      font-size: 13px;
    }

    .warning-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #f59e0b;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
    }

    @media (max-width: 600px) {
      .factor-fields {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class FactorValuesComponent implements OnInit {
  readonly wizardState = inject(WizardStateService);
  readonly characteristicOptions = CHARACTERISTIC_OPTIONS;

  ngOnInit(): void {
    this.wizardState.ensureDefaultFactors();
  }

  onNameChange(index: number, name: string): void {
    this.wizardState.updateFactor(index, { name });
  }

  onSourceChange(index: number, sourceId: string): void {
    const sourceCharacteristic = sourceId || null;
    const updates: Partial<WizardFactor> = { sourceCharacteristic };
    if (sourceCharacteristic && !this.wizardState.factors()[index].name.trim()) {
      updates.name = sourceCharacteristic;
    }
    if (sourceCharacteristic && sourceCharacteristic !== this.wizardState.factors()[index].name) {
      // Keep existing custom names; only auto-fill when empty
    }
    this.wizardState.updateFactor(index, updates);
  }

  addCustomFactor(): void {
    this.wizardState.addFactor({
      name: '',
      sourceCharacteristic: null,
      defaultValue: 'not available',
      enabled: true,
    });
  }
}
