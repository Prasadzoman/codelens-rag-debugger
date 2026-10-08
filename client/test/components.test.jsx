import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagnosisCard } from '../src/components/DiagnosisCard';
import { InsufficientEvidenceCard } from '../src/components/InsufficientEvidenceCard';
import { SuggestedFixCard } from '../src/components/SuggestedFixCard';
import { CodeViewer } from '../src/components/CodeViewer';

describe('Frontend UI Components', () => {
  it('renders DiagnosisCard with confidence and primary location', () => {
    const mockDiagnosis = {
      status: 'FOUND',
      diagnosis: 'Stale state in filter handler',
      errorType: 'state_management',
      confidence: 0.94,
      primaryLocation: {
        file: 'EmployeeList.jsx',
        startLine: 24,
        endLine: 31
      },
      explanation: 'React state update is asynchronous.',
      relatedLocations: []
    };

    render(<DiagnosisCard diagnosis={mockDiagnosis} onJumpLocation={vi.fn()} />);

    expect(screen.getByText('Diagnosis Overview')).toBeDefined();
    expect(screen.getByText('94%')).toBeDefined();
    expect(screen.getByText('EmployeeList.jsx')).toBeDefined();
    expect(screen.getByText('(Lines 24–31)')).toBeDefined();
    expect(screen.getByText('Stale state in filter handler')).toBeDefined();
  });

  it('renders InsufficientEvidenceCard when status is INSUFFICIENT_EVIDENCE', () => {
    const mockNegative = {
      status: 'INSUFFICIENT_EVIDENCE',
      diagnosis: 'The uploaded files do not match this query.',
      explanation: 'CodeLens refrains from guessing.'
    };

    render(<InsufficientEvidenceCard diagnosis={mockNegative} />);
    expect(screen.getByText('INSUFFICIENT_EVIDENCE')).toBeDefined();
    expect(screen.getByText('The uploaded files do not match this query.')).toBeDefined();
  });

  it('renders SuggestedFixCard with code and target details', () => {
    const mockFix = {
      description: 'Filter on the event value directly.',
      code: 'const results = initialEmployees.filter(...);'
    };
    const mockLoc = {
      file: 'EmployeeList.jsx',
      startLine: 27,
      endLine: 30
    };

    render(<SuggestedFixCard fix={mockFix} primaryLocation={mockLoc} />);
    expect(screen.getByText('Suggested Fix')).toBeDefined();
    expect(screen.getByText('Filter on the event value directly.')).toBeDefined();
    expect(screen.getByText('const results = initialEmployees.filter(...);')).toBeDefined();
  });

  it('renders CodeViewer with line numbers and highlighted line range', () => {
    const mockFile = {
      name: 'Test.js',
      fileName: 'Test.js',
      content: `line one
line two
line three
line four`
    };

    const highlightRange = { startLine: 2, endLine: 3 };

    render(
      <CodeViewer
        file={mockFile}
        highlightRange={highlightRange}
        allFiles={[mockFile]}
        onSelectFile={vi.fn()}
      />
    );

    expect(screen.getByText('Lines 2–3')).toBeDefined();
    expect(screen.getByText('line two')).toBeDefined();
    expect(screen.getByText('line three')).toBeDefined();
  });
});
