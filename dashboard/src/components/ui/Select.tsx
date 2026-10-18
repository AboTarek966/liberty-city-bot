'use client';

import { forwardRef, SelectHTMLAttributes, OptionHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, placeholder, id, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="label">
            {label}
            {props.required && <span className="text-liberty-error ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'input',
            error && 'border-liberty-error focus:ring-liberty-error',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="mt-1 text-sm text-liberty-error" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${selectId}-helper`} className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

interface MultiSelectProps extends Omit<SelectProps, 'multiple'> {
  multiple?: true;
  value?: string[];
  onChange?: (values: string[]) => void;
}

export const MultiSelect = forwardRef<HTMLSelectElement, MultiSelectProps>(
  ({ className, label, error, helperText, options, placeholder, multiple = true, value = [], onChange, id, ...props }, ref) => {
    const selectId = id || props.name;
    
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
      onChange?.(selected);
    };

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="label">
            {label}
            {props.required && <span className="text-liberty-error ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          multiple={multiple}
          value={value}
          onChange={handleChange}
          className={cn(
            'input min-h-[100px]',
            error && 'border-liberty-error focus:ring-liberty-error',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-sm text-liberty-error" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

MultiSelect.displayName = 'MultiSelect';