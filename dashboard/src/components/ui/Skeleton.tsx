'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({ 
  className, 
  variant = 'text', 
  width, 
  height, 
  lines = 1,
  ...props 
}: SkeletonProps) {
  if (variant === 'circular') {
    return (
      <div
        className={cn(
          'animate-pulse rounded-full bg-liberty-border',
          'relative overflow-hidden'
        )}
        style={{ width, height }}
        {...props}
      />
    );
  }

  if (variant === 'rectangular') {
    return (
      <div
        className={cn(
          'animate-pulse rounded-lg bg-liberty-border',
          'relative overflow-hidden'
        )}
        style={{ width, height }}
        {...props}
      />
    );
  }

  // Text variant - multiple lines
  if (lines > 1) {
    return (
      <div className={cn('space-y-3', props.className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'animate-pulse h-4 bg-liberty-border rounded',
              i === lines - 1 && 'w-3/4'
            )}
            style={{ width: i === lines - 1 ? undefined : width }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'animate-pulse h-4 bg-liberty-border rounded',
        props.className
      )}
      style={{ width }}
      {...props}
    />
  );
}

// Pre-built skeleton components for common use cases
export const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn('card-hover', className)}>
    <Skeleton variant="rectangular" width="100%" height={200} className="mb-4" />
    <div className="space-y-3 px-2">
      <Skeleton width="60%" height={24} />
      <Skeleton width="40%" height={16} />
      <Skeleton width="80%" height={16} />
    </div>
  );

export const SkeletonTableRow = ({ columns = 4 }: { columns?: number }) => (
  <tr>
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton variant="text" width={i === 0 ? '80%' : '60%'} />
      </td>
    ))}
  </tr>
);

export const SkeletonListItem = ({ className }: { className?: string }) => (
  <div className={cn('flex items-center gap-4 p-4', className)}>
    <Skeleton variant="circular" width={48} height={48} />
    <div className="flex-1 space-y-2">
      <Skeleton width="40%" height={20} />
      <Skeleton width="60%" height={14} />
    </div>
  </div>
);

export const SkeletonAvatar = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizes = { sm: 32, md: 40, lg: 56, xl: 64 };
  return <Skeleton variant="circular" width={sizes[size]} height={sizes[size]} />;
};

export const SkeletonButton = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const heights = { sm: 32, md: 40, lg: 48 };
  const widths = { sm: 80, md: 120, lg: 160 };
  return <Skeleton variant="rectangular" width={widths[size]} height={heights[size]} />;
};