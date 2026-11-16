import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/components/ui/Modal';

describe('Modal component', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog, title, description, and children when isOpen is true', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Confirm Transition"
        description="Advance case to next stage"
      >
        <div>Modal Body Content</div>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm Transition')).toBeInTheDocument();
    expect(screen.getByText('Advance case to next stage')).toBeInTheDocument();
    expect(screen.getByText('Modal Body Content')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Dialog">
        <button type="button">Inside</button>
      </Modal>
    );

    const closeButton = screen.getByRole('button', { name: /close dialog/i });
    await user.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Dialog">
        <input placeholder="Enter text" />
      </Modal>
    );

    await user.keyboard('{Escape}');

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus into modal upon opening and restores focus to previous element upon closing', () => {
    const triggerButton = document.createElement('button');
    triggerButton.textContent = 'Open Dialog';
    document.body.appendChild(triggerButton);
    triggerButton.focus();
    expect(document.activeElement).toBe(triggerButton);

    const { rerender } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Focus Test">
        <button type="button">Action Inside</button>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    rerender(
      <Modal isOpen={false} onClose={vi.fn()} title="Focus Test">
        <button type="button">Action Inside</button>
      </Modal>
    );

    expect(document.activeElement).toBe(triggerButton);
    document.body.removeChild(triggerButton);
  });
});
