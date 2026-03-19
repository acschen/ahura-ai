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

  // Close on escape
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-ahura-dark border-t border-gray-700 rounded-t-2xl overflow-hidden animate-slide-up flex flex-col"
      >
        {/* Handle + Header */}
        <div className="flex-shrink-0 pt-3 pb-2 px-4">
          <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            {title && (
              <h3 className="text-sm font-semibold text-white">{title}</h3>
            )}
            <button
              onClick={onClose}
              className="ml-auto text-gray-400 hover:text-white p-1"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-safe pb-6 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}
