"use client";

import { useEffect, useRef, ReactNode } from "react";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export default function MobileDrawer({
  isOpen,
  onClose,
  children,
  title,
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-surface-primary border-t border-edge rounded-t-xl overflow-hidden flex flex-col animate-fade-in"
      >
        <div className="flex-shrink-0 pt-3 pb-2 px-4">
          <div className="w-8 h-0.5 bg-edge rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            {title && (
              <h3 className="text-xs font-medium text-content-primary">{title}</h3>
            )}
            <button
              onClick={onClose}
              className="ml-auto text-content-tertiary hover:text-content-secondary p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}
