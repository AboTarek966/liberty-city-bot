'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ content, children, position = 'top', delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const childRef = useRef<HTMLElement>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!children || !children.props) {
    return <>{children}</>;
  }

  const child = children as React.ReactElement<any>;
  const childProps = child.props;

  return (
    <>
      <span
        ref={childRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        {...childProps}
      >
        {child}
      </span>

      {isVisible && (
        <div
          className={cn(
            'fixed z-50 px-3 py-2 text-sm text-white bg-liberty-darker rounded-lg',
            'border border-liberty-border shadow-lg',
            'animate-fade-in whitespace-nowrap max-w-xs',
            'pointer-events-none'
          )}
          style={{
            position: 'fixed',
            zIndex: 50,
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}

export default Tooltip;