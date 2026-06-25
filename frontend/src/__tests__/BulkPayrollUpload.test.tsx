import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type React from 'react';

vi.mock('@stellar/design-system', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/CSVUploader', () => ({
  CSVUploader: ({
    requiredColumns,
    validators,
    onDataParsed,
  }: {
    requiredColumns: string[];
    validators: Record<string, (v: string) => string | null>;
    onDataParsed: (rows: Array<{ rowNumber: number; data: Record<string, string>; errors: string[]; isValid: boolean }>) => void;
  }) => (
    <div data-testid="csv-uploader">
      <span data-testid="required-cols">{requiredColumns.join(',')}</span>
      <button
        data-testid="trigger-parse"
        onClick={() => {
          const currencyValidator = validators.currency;
          const result = currencyValidator('INVALID');
          onDataParsed([
            {
              rowNumber: 1,
              data: { name: 'Test', wallet_address: 'GABCDEF12345678901234567890123456789012345678901234567890123', amount: '100', currency: 'INVALID' },
              errors: result ? [result] : [],
              isValid: !result,
            },
          ]);
        }}
      >
        Parse invalid currency
      </button>
    </div>
  ),
}));

vi.mock('../components/IssuerMultisigBanner', () => ({
  default: () => <div data-testid="multisig-banner" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

import BulkPayrollUpload from '../pages/BulkPayrollUpload';
import { SUPPORTED_ASSETS } from '../config/assets';

describe('BulkPayrollUpload', () => {
  it('uses centralized asset list instead of hardcoded values', () => {
    render(<BulkPayrollUpload />);

    const expectedCodes = SUPPORTED_ASSETS.map((a) => a.code);
    const csvUploader = screen.getByTestId('csv-uploader');
    expect(csvUploader).toBeTruthy();
  });

  it('validates currency against centralized asset codes', () => {
    render(<BulkPayrollUpload />);

    fireEvent.click(screen.getByTestId('trigger-parse'));

    const currencyLabel = SUPPORTED_ASSETS.map((a) => a.code).join(', ');
    expect(screen.getByText(/Currency must be one of/i)).toBeTruthy();
  });

  it('shows i18n labels in currency validation error', () => {
    render(<BulkPayrollUpload />);

    fireEvent.click(screen.getByTestId('trigger-parse'));

    SUPPORTED_ASSETS.forEach((asset) => {
      expect(screen.getByText(new RegExp(asset.code, 'i'))).toBeTruthy();
    });
  });
});

describe('SUPPORTED_ASSETS config', () => {
  it('includes USDC, XLM, EURC, and ORGUSD', () => {
    const codes = SUPPORTED_ASSETS.map((a) => a.code);
    expect(codes).toContain('USDC');
    expect(codes).toContain('XLM');
    expect(codes).toContain('EURC');
    expect(codes).toContain('ORGUSD');
  });
});
