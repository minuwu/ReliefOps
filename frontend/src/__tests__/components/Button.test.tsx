import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';

describe('Button component', () => {
  it('renders button with children text', () => {
    render(<Button>Submit Claim</Button>);

    const button = screen.getByRole('button', { name: /submit claim/i });
    expect(button).toBeInTheDocument();
  });

  it('handles user click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables button and displays loading spinner when isLoading is true', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button isLoading onClick={handleClick}>
        Save
      </Button>
    );

    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('prevents click events when explicitly disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Locked
      </Button>
    );

    const button = screen.getByRole('button', { name: /locked/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies variant styling classes correctly', () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-[#FF334B]');

    rerender(<Button variant="outline">Back</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-[#F8F4E8]');
  });
});
