import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToastStore, toast } from '@/store/useToastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('pushes a new toast with tone and expiry timestamp', () => {
    const fixedNow = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    useToastStore.getState().push('Case saved successfully', 'success');

    const { toasts } = useToastStore.getState();
    expect(toasts.length).toBe(1);
    expect(toasts[0].message).toBe('Case saved successfully');
    expect(toasts[0].tone).toBe('success');
    expect(toasts[0].durationMs).toBe(4000);

    vi.restoreAllMocks();
  });

  it('sets longer 8 second expiry for error tone', () => {
    const fixedNow = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    useToastStore.getState().push('Operation failed', 'error');

    const { toasts } = useToastStore.getState();
    expect(toasts.length).toBe(1);
    expect(toasts[0].tone).toBe('error');
    expect(toasts[0].durationMs).toBe(8000);

    vi.restoreAllMocks();
  });

  it('ignores empty or whitespace-only messages', () => {
    useToastStore.getState().push('   ');
    useToastStore.getState().push('');

    expect(useToastStore.getState().toasts.length).toBe(0);
  });

  it('skips duplicate messages that are already visible', () => {
    useToastStore.getState().push('Network glitch');
    useToastStore.getState().push('Network glitch');
    useToastStore.getState().push('  Network glitch  ');

    expect(useToastStore.getState().toasts.length).toBe(1);
  });

  it('limits visible toasts to a maximum of three newest items', () => {
    useToastStore.getState().push('Toast 1');
    useToastStore.getState().push('Toast 2');
    useToastStore.getState().push('Toast 3');
    useToastStore.getState().push('Toast 4');

    const { toasts } = useToastStore.getState();
    expect(toasts.length).toBe(3);
    expect(toasts.map((t) => t.message)).toEqual(['Toast 2', 'Toast 3', 'Toast 4']);
  });

  it('dismisses toast by id', () => {
    useToastStore.getState().push('Toast to remove');
    const id = useToastStore.getState().toasts[0].id;

    useToastStore.getState().dismiss(id);

    expect(useToastStore.getState().toasts.length).toBe(0);
  });

  it('provides standalone toast helper function', () => {
    toast('Standalone message', 'info');

    const { toasts } = useToastStore.getState();
    expect(toasts.length).toBe(1);
    expect(toasts[0].message).toBe('Standalone message');
    expect(toasts[0].tone).toBe('info');
  });
});
