'use client';

import { cn } from '@/lib/utils';

interface TabsProps {
  tabs: Array<{ id: string; label: string; icon?: React.ReactNode; disabled?: boolean }>;
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export function Tabs({ 
  tabs, 
  activeTab, 
  onChange, 
  variant = 'default', 
  className 
}: TabsProps) {
  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'flex gap-1',
          variant === 'pills' && 'bg-liberty-darker rounded-lg p-1',
          variant === 'underline' && 'border-b border-liberty-border',
          'flex-wrap'
        )}
        role="tablist"
        aria-label="Tabs"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-liberty-primary focus:ring-offset-2 focus:ring-offset-liberty-dark',
              activeTab === tab.id
                ? 'bg-liberty-primary text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-liberty-border',
              disabled: tab.disabled ? 'opacity-50 cursor-not-allowed' : ''
            )}
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface TabPanelProps {
  id: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ id, active, children, className }: TabPanelProps) {
  if (!active) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      className={cn('animate-fade-in', className)}
    >
      {children}
    </div>
  );
}