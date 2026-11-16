import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatEnumLabel,
  pluralize,
} from '@/lib/utils';

describe('cn utility', () => {
  it('combines multiple class names and resolves conflicting tailwind classes', () => {
    const combined = cn('px-4 py-2', 'bg-red-500', { 'text-white': true, 'opacity-50': false });
    expect(combined).toBe('px-4 py-2 bg-red-500 text-white');

    const merged = cn('p-4', 'p-2');
    expect(merged).toBe('p-2');
  });
});

describe('formatCurrency', () => {
  it('returns an em-dash for null or undefined amounts', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
  });

  it('formats positive numbers as Japanese Yen with no fractional digits by default', () => {
    const formatted = formatCurrency(1450000);
    expect(formatted.replace(/\s/g, '')).toMatch(/[¥￥]1,450,000/);
  });

  it('formats zero correctly', () => {
    const formatted = formatCurrency(0);
    expect(formatted.replace(/\s/g, '')).toMatch(/[¥￥]0/);
  });

  it('formats other currencies when specified', () => {
    const formatted = formatCurrency(500, 'USD');
    expect(formatted.replace(/\s/g, '')).toMatch(/\$500/);
  });
});

describe('formatEnumLabel', () => {
  it('returns em-dash for empty, null, or undefined values', () => {
    expect(formatEnumLabel(null)).toBe('—');
    expect(formatEnumLabel(undefined)).toBe('—');
    expect(formatEnumLabel('')).toBe('—');
  });

  it('converts snake_case values to title sentence case', () => {
    expect(formatEnumLabel('account_check')).toBe('Account check');
    expect(formatEnumLabel('notice_published')).toBe('Notice published');
    expect(formatEnumLabel('closed')).toBe('Closed');
  });
});

describe('pluralize', () => {
  it('formats singular nouns for count of 1', () => {
    expect(pluralize(1, 'case')).toBe('1 case');
    expect(pluralize(1, 'alert', 'alerts')).toBe('1 alert');
  });

  it('formats plural nouns for counts other than 1', () => {
    expect(pluralize(0, 'case')).toBe('0 cases');
    expect(pluralize(2, 'case')).toBe('2 cases');
    expect(pluralize(5, 'person', 'people')).toBe('5 people');
  });
});

describe('formatDate', () => {
  it('returns em-dash for missing values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('formats standard ISO dates into en-US short date format', () => {
    const formatted = formatDate('2026-11-15T12:00:00Z');
    expect(formatted).toMatch(/Nov\s+15,\s+2026/);
  });
});

describe('formatDateTime', () => {
  it('returns em-dash for missing values', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });

  it('formats standard ISO timestamps with month, day, and time', () => {
    const formatted = formatDateTime('2026-11-15T12:30:00Z');
    expect(formatted).toMatch(/Nov\s+15/);
  });
});
