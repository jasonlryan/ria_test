import React, { ReactNode } from "react";

interface CollapsibleBlockProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  isOpen: boolean;
  onToggle: () => void;
  id: string;
}

export default function CollapsibleBlock({
  title,
  icon,
  children,
  className = "",
  isOpen,
  onToggle,
  id,
}: CollapsibleBlockProps) {
  return (
    <div
      className={`mb-4 rounded-lg overflow-hidden shadow-sm border border-secondary ${className}`}
    >
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-primary text-white hover:bg-secondary transition-colors"
      >
        <div className="flex items-center">
          {icon && <span className="mr-2 text-yellow-400">{icon}</span>}
          <h3 className="font-medium">{title}</h3>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
          className={`w-4 h-4 transition-transform ${
            isOpen ? "transform rotate-180" : ""
          }`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-white md:max-h-none max-h-[40vh] md:overflow-visible overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}
