import React, { useEffect, useState } from "react";

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

  // Check if a question has been passed in the URL, if so, run the question
  const searchParams = useSearchParams();
  const question = searchParams.get("question");

  useEffect(() => {
    setPrompt(question);
    setPromptClicked(true);
  }, []);

  useEffect(() => {
    if (prompt && promptClicked) {
      sendPrompt(threadId);
      setPromptClicked(false);
    }
  }, [prompt, threadId]);

  return (
    <div className="w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendPrompt(threadId);
        }}
        className="relative"
      >
        <input
          id="question"
          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-tertiary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-sm sm:text-base"
          placeholder="Ask RIA about the Workforce 2025 Survey..."
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
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
