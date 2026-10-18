'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot, children, ...props }, ref) => {
    const variants = {
      default: 'bg-liberty-secondary/20 text-liberty-secondary border border-liberty-secondary/30',
      success: 'badge-success',
      warning: 'badge-warning',
      danger: 'badge-danger',
      info: 'badge-info',
      outline: 'bg-transparent border border-liberty-border text-gray-400',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-xs',
      lg: 'px-3 py-1 text-sm',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium',
          variants[variant],
          sizes[size],
          props.className
        )}
      >
        {dot && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
        {props.children || children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export const StatusBadge = ({ status }: { status: 'online' | 'idle' | 'dnd' | 'offline' | 'streaming' }) => {
  const configs = {
    online: { label: 'نشط', variant: 'success' as const, dot: true },
    idle: { label: 'خامل', variant: 'warning' as const, dot: true },
    dnd: { label: 'مشغول', variant: 'danger' as const, dot: true },
    streaming: { label: 'بث مباشر', variant: 'info' as const, dot: true },
    offline: { label: 'غير متصل', variant: 'outline' as const, dot: false },
  } as const;

  const config = configs[status];
  return <Badge variant={config.variant} dot={config.dot}>{config.label}</Badge>;
};

export const RoleBadge = ({ role }: { role: { name: string; color: string; position: number } }) => (
  <span
    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    style={{
      backgroundColor: `${role.color}20`,
      borderColor: `${role.color}40`,
      color: role.color,
      borderWidth: '1px',
      borderStyle: 'solid',
    }}
  >
    {role.name}
  </span>
);