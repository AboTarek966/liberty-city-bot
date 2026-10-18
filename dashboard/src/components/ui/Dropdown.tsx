'use client';

import { Fragment, useRef, useEffect, useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface DropdownProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  align?: 'left' | 'right';
  offset?: number;
}

export function Dropdown({ trigger, content, align = 'right', offset = 4 }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        contentRef.current &&
        !contentRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      
      {isOpen && (
        <Fragment>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={contentRef}
            className={cn(
              'fixed z-50 min-w-[180px] bg-liberty-darker rounded-lg border border-liberty-border',
              'shadow-lg animate-slide-up py-1',
              'left-0 top-full',
              'mt-1.5'
            )}
            style={{
              right: 'auto',
              left: '0',
            }}
            role="menu"
            aria-orientation="vertical"
          >
            <div className="py-1">{props.children}</div>
          </div>
        )}
      </Fragment>
    );
  }
});

export interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
}

export function DropdownItem({ 
  children, 
  icon, 
  shortcut, 
  danger,
  className,
  onClick,
  ...props 
}: DropdownItemProps) {
  return (
    <button
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        // Don't close on click if needed
      }}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2 text-sm text-white',
        'hover:bg-liberty-primary/20',
        'transition-colors duration-150',
        'focus:outline-none focus:bg-liberty-primary/20',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
      onClick={props.onClick}
    >
      {props.icon && <span className="w-5 h-5 flex-shrink-0">{props.icon}</span>}
      <span className="flex-1 text-left">{props.children}</span>
      {props.shortcut && (
        <kbd className="px-2 py-0.5 text-xs text-gray-500 bg-liberty-border rounded">
          {props.shortcut}
        </kbd>
      )}
    </button>
  );
}

export const DropdownDivider = () => (
  <div className="h-px bg-liberty-border my-1" role="separator" />
);

export const DropdownHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
    {children}
  </div>
);