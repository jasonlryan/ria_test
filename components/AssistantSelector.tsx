import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Assistant {
  id: string;
  name: string;
}

interface AssistantSelectorProps {
  currentAssistantId: string;
}

const AssistantSelector: React.FC<AssistantSelectorProps> = ({
  currentAssistantId,
}) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Define the list of assistants
  const assistants: Assistant[] = [
    { id: "asst_xOd6VeXqgta6bxY1LkatulKU", name: "Default Assistant" },
    { id: "asst_T8WLaYpjA8l8JGApPGx6oyKq", name: "Test Assistant" },
    { id: "asst_D0BPAJjvg3UK6Lcb1lqIM1xS", name: "2-Step" },
  ];

  // Find the current assistant
  const currentAssistant =
    assistants.find((a) => a.id === currentAssistantId) || assistants[0];

  const handleAssistantChange = (newAssistantId: string) => {
    if (newAssistantId !== currentAssistantId) {
      // Navigate to the new assistant's embed page
      router.push(`/embed/${newAssistantId}`);
    }
    setIsOpen(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="assistant-selector relative" ref={menuRef}>
      {/* Fixed width button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 px-2 py-1 whitespace-nowrap w-[180px] text-left flex items-center justify-between"
      >
        <span className="truncate">{currentAssistant.name}</span>
        <span className="ml-1 flex-shrink-0">{isOpen ? "▽" : "△"}</span>
      </button>

      {/* Dropdown menu - opens upward with fixed width */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-300 rounded-md shadow-sm z-50 w-[180px]">
          {assistants.map((assistant) => (
            <div
              key={assistant.id}
              className={`px-2 py-1 text-xs cursor-pointer hover:bg-gray-100 truncate ${
                assistant.id === currentAssistantId ? "bg-gray-100" : ""
              }`}
              onClick={() => handleAssistantChange(assistant.id)}
            >
              {assistant.name}
              {assistant.id === currentAssistantId && (
                <span className="float-right">✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssistantSelector;
