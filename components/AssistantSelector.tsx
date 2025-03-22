import React from "react";
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

  // Define the list of assistants
  const assistants: Assistant[] = [
    { id: "asst_xOd6VeXqgta6bxY1LkatulKU", name: "Default Assistant" },
    { id: "asst_T8WLaYpjA8l8JGApPGx6oyKq", name: "Test Assistant" },
  ];

  const handleAssistantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAssistantId = e.target.value;
    if (newAssistantId !== currentAssistantId) {
      // Navigate to the new assistant's embed page
      router.push(`/embed/${newAssistantId}`);
    }
  };

  return (
    <div className="assistant-selector mb-4">
      <label
        htmlFor="assistant-select"
        className="block text-xs text-gray-500 mb-1"
      >
        Select Assistant Version:
      </label>
      <select
        id="assistant-select"
        value={currentAssistantId}
        onChange={handleAssistantChange}
        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {assistants.map((assistant) => (
          <option key={assistant.id} value={assistant.id}>
            {assistant.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AssistantSelector;
