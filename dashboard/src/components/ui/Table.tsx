'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, striped, hover, compact, children, ...props }, ref) => (
    <div className="overflow-x-auto">
      <table
        ref={ref}
        className={cn(
          'w-full text-sm text-left',
          'border-collapse',
          props.className
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  )
);

Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, children, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        'border-b border-liberty-border bg-liberty-darker/50',
        '[&_tr]:border-b',
        props.className
      )}
      {...props}
    >
      {children}
    </thead>
  )
);

TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, children, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn(
        '[&_tr:last-child]:border-0',
        props.className
      )}
      {...props}
    >
      {children}
    </tbody>
  )
);

TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-liberty-border/50 transition-colors',
        'hover:bg-liberty-darker/50',
        'data-[state=selected]:bg-liberty-primary/10',
        props.className
      )}
      {...props}
    >
      {props.children}
    </tr>
  )
);

TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'px-4 py-3 font-semibold text-gray-400',
        'border-b border-liberty-border',
        props.className
      )}
      {...props}
    >
      {props.children}
    </th>
  )
);

TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, HTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('px-4 py-3 text-white', props.className)}
      {...props}
    >
      {props.children}
    </td>
  )
);

TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn('text-sm text-gray-500 py-4', props.className)}
      {...props}
    >
      {props.children}
    </caption>
  )
);

TableCaption.displayName = 'TableCaption';