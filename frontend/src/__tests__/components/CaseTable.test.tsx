import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseTable } from '@/components/cases/CaseTable';
import type { CaseSummary } from '@/types/api';

const sampleCases: CaseSummary[] = [
  {
    id: 'case-01',
    reference: 'RFR-2026-00001',
    bank_id: 'bank_a',
    bank_name: 'Aster Regional Bank',
    victim_name: 'Kenji Sato',
    amount: 1500000,
    currency: 'JPY',
    scam_type: 'impersonation',
    status: 'verified',
    deadline: '2026-11-20T10:00:00Z',
    deadline_state: 'on_track',
    assigned_operator: null,
    reported_date: '2026-11-01',
    updated_at: '2026-11-02T10:00:00Z',
    flags: {
      missing_fields: [],
      ai_review_pending: true,
      shared_account_case_count: 2,
      victim_question_pending: false,
      possible_duplicate: false,
    },
  },
  {
    id: 'case-02',
    reference: 'RFR-2026-00002',
    bank_id: 'bank_b',
    bank_name: 'Birch Regional Bank',
    victim_name: 'Yuki Tanaka',
    amount: 300000,
    currency: 'JPY',
    scam_type: 'phishing',
    status: 'account_check',
    deadline: '2026-11-18T10:00:00Z',
    deadline_state: 'due_soon',
    assigned_operator: null,
    reported_date: '2026-11-02',
    updated_at: '2026-11-03T10:00:00Z',
    flags: {
      missing_fields: [],
      ai_review_pending: false,
      shared_account_case_count: 0,
      victim_question_pending: false,
      possible_duplicate: false,
    },
  },
];

describe('CaseTable component', () => {
  it('displays empty state message when case list is empty', () => {
    render(<CaseTable cases={[]} focusedIndex={0} onSelectCase={vi.fn()} />);

    expect(screen.getByText(/no matching claims/i)).toBeInTheDocument();
    expect(screen.getByText(/adjust search terms or reset filters/i)).toBeInTheDocument();
  });

  it('renders table rows with case details', () => {
    render(<CaseTable cases={sampleCases} focusedIndex={0} onSelectCase={vi.fn()} />);

    expect(screen.getByText('RFR-2026-00001')).toBeInTheDocument();
    expect(screen.getByText('Kenji Sato')).toBeInTheDocument();
    expect(screen.getByText('bank_a')).toBeInTheDocument();

    expect(screen.getByText('RFR-2026-00002')).toBeInTheDocument();
    expect(screen.getByText('Yuki Tanaka')).toBeInTheDocument();
    expect(screen.getByText('bank_b')).toBeInTheDocument();
  });

  it('calls onSelectCase when a row is clicked', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(<CaseTable cases={sampleCases} focusedIndex={0} onSelectCase={handleSelect} />);

    const firstRow = screen.getByText('RFR-2026-00001').closest('tr');
    expect(firstRow).not.toBeNull();
    if (firstRow) {
      await user.click(firstRow);
      expect(handleSelect).toHaveBeenCalledWith(sampleCases[0], 0);
    }
  });

  it('has tabIndex 0 on case rows for keyboard navigation accessibility', () => {
    render(<CaseTable cases={sampleCases} focusedIndex={0} onSelectCase={vi.fn()} />);

    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveAttribute('tabindex', '0');
    expect(rows[1]).toHaveAttribute('tabindex', '0');
  });

  it('triggers onSelectCase when Enter is pressed on a focused row', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(<CaseTable cases={sampleCases} focusedIndex={0} onSelectCase={handleSelect} />);

    const firstRow = screen.getByText('RFR-2026-00001').closest('tr');
    expect(firstRow).not.toBeNull();
    if (firstRow) {
      firstRow.focus();
      await user.keyboard('{Enter}');
      expect(handleSelect).toHaveBeenCalledWith(sampleCases[0], 0);
    }
  });

  it('triggers onSelectCase when Space is pressed on a focused row', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(<CaseTable cases={sampleCases} focusedIndex={1} onSelectCase={handleSelect} />);

    const secondRow = screen.getByText('RFR-2026-00002').closest('tr');
    expect(secondRow).not.toBeNull();
    if (secondRow) {
      secondRow.focus();
      await user.keyboard(' ');
      expect(handleSelect).toHaveBeenCalledWith(sampleCases[1], 1);
    }
  });
});
