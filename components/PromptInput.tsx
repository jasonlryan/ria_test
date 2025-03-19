import React, { useEffect, useState, KeyboardEvent } from "react";

import Send from "./icons/Send";
import { useSearchParams } from "next/navigation";

const queries = [
  "How do I use this?",
  "What regions are covered?",
  "What is the appetite for re-skilling in the UK?",
];

export default function PromptInput({
  prompt,
  setPrompt,
  sendPrompt,
  threadId,
  loading,
}: {
  prompt: string;
  setPrompt: (prompt: string) => void;
  sendPrompt: (threadId?: string) => void;
  threadId: string;
  loading: boolean;
}) {
  // State to check if the prompt button is clicked.
  const [promptClicked, setPromptClicked] = useState(false);
  // Track if the component has mounted to prevent auto-sending on first keystroke
  const [hasMounted, setHasMounted] = useState(false);

  // Check if a question has been passed in the URL, if so, run the question
  const searchParams = useSearchParams();
  const question = searchParams.get("question");

  useEffect(() => {
    // This runs only once on component mount
    setHasMounted(true);
    if (question) {
      setPrompt(question);
      setPromptClicked(true);
    }
  }, []);

  useEffect(() => {
    // Only send prompt if explicitly clicked or from URL parameter
    // Avoid sending on first keystroke when editing manually
    if (prompt && promptClicked && hasMounted) {
      sendPrompt(threadId);
      setPromptClicked(false);
    }
  }, [prompt, threadId, promptClicked, hasMounted]);

  // Handle keyboard events to support SHIFT+RETURN for new line
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      // If SHIFT+ENTER, allow adding a new line
      if (e.shiftKey) {
        return; // Default behavior will add a line break
      }
      // If just ENTER without shift, submit the form
      e.preventDefault();
      if (prompt && !loading) {
        setPromptClicked(true);
      }
    }
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPromptClicked(true);
        }}
        className="relative"
      >
        <textarea
          id="question"
          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-tertiary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-sm sm:text-base resize-none overflow-y-auto"
          placeholder="Ask RIA about the Workforce 2025 Survey... (Press SHIFT+RETURN for new line)"
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={3}
          style={{ minHeight: "80px", maxHeight: "200px" }}
        />
        <button
          type="submit"
          className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 bg-primary text-white p-1.5 sm:p-2 rounded-full hover:bg-secondary transition-colors disabled:opacity-50 disabled:hover:bg-primary"
          disabled={!prompt || loading}
        >
          <Send className="h-4 w-4 sm:h-5 sm:w-5 stroke-current" />
        </button>
      </form>
    </div>
  );
}
