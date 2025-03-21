import React, { useEffect } from "react";
import Image from "next/image";

interface NavProps {
  refreshChat: () => void;
  title: string;
}

export default function Nav({ refreshChat }: NavProps) {
  useEffect(() => {
    console.log("=== NAV COMPONENT DIAGNOSTICS ===");
    console.log("Nav Component Loaded");
    console.log("Render Time:", new Date().toISOString());
    console.log("========================");
  }, []);

  return (
    <div className="flex justify-between items-center py-2 sm:py-3 mb-2 sm:mb-3">
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
    </div>
  );
}
