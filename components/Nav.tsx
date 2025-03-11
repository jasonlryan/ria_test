import React from "react";
import Image from "next/image";

interface NavProps {
  refreshChat: () => void;
  title: string;
}

export default function Nav({ refreshChat }: NavProps) {
  return (
    <div className="flex justify-between items-center py-3 sm:py-4 mb-4 sm:mb-6">
      <div className="flex items-center">
        <Image
          height={28}
          width={160}
          src="/kf-logo.png"
          alt="Korn Ferry"
          className="mr-2 sm:hidden"
        />
        <Image
          height={32}
          width={180}
          src="/kf-logo.png"
          alt="Korn Ferry"
          className="mr-2 hidden sm:block"
        />
      </div>

      <button
        onClick={refreshChat}
        className="p-1.5 sm:p-2 text-tertiary hover:text-primary rounded-full hover:bg-secondary hover:bg-opacity-10 transition-colors"
        aria-label="Reset conversation"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-4 h-4 sm:w-5 sm:h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      </button>
    </div>
  );
}
