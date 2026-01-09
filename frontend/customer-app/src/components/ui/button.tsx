import * as React from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading,
  fullWidth,
  leftIcon,
  rightIcon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={loading || disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
        'active:scale-95 touch-target',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 py-2.5 text-base',
        size === 'lg' && 'h-12 px-6 py-3 text-lg',
        variant === 'primary' && 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
        variant === 'secondary' && 'bg-secondary-600 text-white hover:bg-secondary-700 shadow-sm',
        variant === 'outline' && 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950',
        variant === 'ghost' && 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
        variant === 'danger' && 'bg-error text-white hover:bg-error-dark shadow-sm',
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="-ml-1">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="-mr-1">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
