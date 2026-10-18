'use client';

import { Fragment, ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  children, 
  size = 'md',
  showCloseButton = true 
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleOverlayClick = (e: MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    };

    if (isOpen) {
      overlayRef.current?.addEventListener('click', handleOverlayClick);
    }

    return () => {
      overlayRef.current?.removeEventListener('click', handleOverlayClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-4xl',
  };

  return (
    <Fragment>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4',
          'animate-slide-up'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
      >
        <div
          className={cn(
            'w-full bg-liberty-darker rounded-2xl border border-liberty-border',
            'shadow-2xl overflow-hidden animate-slide-up',
            'max-h-[90vh] flex flex-col'
          )}
        >
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between p-6 border-b border-liberty-border">
              <div>
                {title && (
                  <h2 className="text-lg font-bold text-white">
                    {title}
                  </h2>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="إغلاق"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </Fragment>
  );
}

export default Modal;