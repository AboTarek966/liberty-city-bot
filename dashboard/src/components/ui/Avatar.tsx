'use client';

import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square';
  status?: 'online' | 'idle' | 'dnd' | 'offline' | 'streaming';
  fallback?: React.ReactNode;
}

export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  shape = 'circle',
  status,
  fallback,
  className,
  ...props
}: AvatarProps) {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-2xl',
  };

  const shapes = {
    circle: 'rounded-full',
    square: 'rounded-lg',
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const statusConfig = {
    online: 'bg-green-500',
    idle: 'bg-yellow-500',
    dnd: 'bg-red-500',
    streaming: 'bg-purple-500',
    offline: 'bg-gray-500',
  };

  return (
    <div
      className={cn('relative inline-flex shrink-0', props.className)}
      {...props}
    >
      <div
        className={cn(
          'relative inline-flex items-center justify-center font-medium bg-liberty-secondary',
          'overflow-hidden',
          sizes[size],
          shapes[shape]
        )}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className={cn(
              'w-full h-full object-cover',
              shapes[shape]
            )}
          />
        ) : fallback ? (
          fallback
        ) : name ? (
          <span className="font-medium text-white">
            {getInitials(name)}
          </span>
        ) : (
          <svg className="w-1/2 h-1/2 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 border-2 border-liberty-darker rounded-full',
            'w-3 h-3 sm:w-3.5 sm:h-3.5',
            statusConfig[status] || statusConfig.offline
          )}
        />
      )}
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const statusConfig = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  streaming: 'bg-purple-500',
  offline: 'bg-gray-500',
};

export default Avatar;