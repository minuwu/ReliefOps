import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 font-['Space_Grotesk',sans-serif]">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={inputId && (error || helperText) ? `${inputId}-hint` : undefined}
          className={cn(
            'flex h-11 w-full rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3.5 py-2 text-sm text-[#09090B] font-medium shadow-[2px_2px_0px_0px_#09090B] transition-all placeholder:text-[#52525B] focus:outline-none focus:shadow-hard focus:translate-x-[-1px] focus:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-[#FF334B] shadow-[2px_2px_0px_0px_#FF334B]',
            className
          )}
          {...props}
        />
        {helperText && !error && (
          <p id={inputId ? `${inputId}-hint` : undefined} className="text-xs text-[#52525B]">
            {helperText}
          </p>
        )}
        {error && (
          <p id={inputId ? `${inputId}-hint` : undefined} role="alert" className="text-xs font-bold text-[#FF334B]">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
