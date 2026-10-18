'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, label, description, size = 'md', id, ...props }, ref) => {
    const toggleId = id || props.name;

    const sizes = {
      sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
      md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
      lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-6' },
    };

    const { track, thumb, translate } = sizes[size];

    return (
      <div className="flex items-center gap-3">
        <div className="relative inline-flex items-center" aria-label={props['aria-label'] || props.label}>
          <input
            ref={ref}
            type="checkbox"
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'relative inline-flex items-center rounded-full transition-colors duration-200 cursor-pointer',
              'after:content-[""] after:absolute after:top-1/2 after:-translate-y-1/2 after:rounded-full after:shadow-lg after:transition-transform after:duration-200',
              'peer-checked:bg-liberty-primary peer-checked:border-liberty-primary',
              'border border-liberty-border bg-liberty-darker',
              'peer-focus:ring-2 peer-focus:ring-liberty-primary peer-focus:ring-offset-2 peer-focus:ring-offset-liberty-dark'
            )}
            style={{ width: track.split(' ')[0], height: track.split(' ')[1] }}
          >
            <span
              className={cn(
                'absolute top-1/2 left-1 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200',
                'peer-checked:translate-x-full',
                `w-${thumb.split(' ')[0].replace('w-', '')} h-${thumb.split(' ')[1].replace('h-', '')}`
              )}
            />
          </div>
        </div>
      </div>
    );
  }
);

Toggle.displayName = 'Toggle';

export interface ToggleWithLabelProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ToggleWithLabel({ 
  label, 
  description, 
  size = 'md', 
  className, 
  id,
  ...props 
}: ToggleWithLabelProps) {
  const toggleId = id || props.name;

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <div className="flex items-center gap-3">
        <Toggle
          ref={props.ref}
          id={toggleId}
          size="md"
          {...props}
        />
        <div className="flex flex-col">
          <label htmlFor={toggleId} className="font-medium text-white cursor-pointer">
            {label}
          </label>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>
    );
  }
}

export default Toggle;