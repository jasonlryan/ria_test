import React, { useState } from "react";

interface AssistantSelectorProps {
  selectedAssistantId?: string;
  onAssistantChange?: (assistantId: string) => void;
}

const AssistantSelector: React.FC<AssistantSelectorProps> = ({
  selectedAssistantId,
  onAssistantChange,
}) => {
  const [selectedAssistant, setSelectedAssistant] = useState(
    selectedAssistantId || "asst_D0BPAJjvg3UK6Lcb1lqIM1xS"
  );

  // Handle assistant selection change
  const handleAssistantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAssistantId = e.target.value;
    setSelectedAssistant(newAssistantId);
    if (onAssistantChange) {
      onAssistantChange(newAssistantId);
    }
  };

  return (
    <div className="mb-4">
      <label
        htmlFor="assistant-selector"
        className="block text-sm font-medium text-gray-700"
      >
        Select Assistant
      </label>
      <select
        id="assistant-selector"
        value={selectedAssistant}
        onChange={handleAssistantChange}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
      >
        <option value="asst_D0BPAJjvg3UK6Lcb1lqIM1xS">
          Research IA Workforce Trends
        </option>
        <option value="asst_alternative">
          Alternative Assistant (if available)
        </option>
      </select>
    </div>
  );
};

export default AssistantSelector;
