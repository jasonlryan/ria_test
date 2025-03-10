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
    <div className="border-t border-primary border-opacity-10 py-2">
      <ul className="mb-2 md:flex gap-2">
        {queries.map((buttonPrompt, id) => {
          return (
            <button
              type="submit"
              key={id}
              onClick={(e) => {
                if (loading) return;
                setPromptClicked(true);
                setPrompt(buttonPrompt);
              }}
              className="border bg-primary text-white border-primary rounded-full px-4 py-2 text-sm hocus:bg-secondary hocus:border-secondary mb-1 md:mb-0 w-full md:w-auto"
            >
              {buttonPrompt}
            </button>
          );
        })}
      </ul>

      <form
        onSubmit={(event) => {
          // Disable submission of form (page refresh)
          event.preventDefault();

          // Send prompt on success submit
          sendPrompt(threadId);
        }}
        className="flex gap-2 mt-auto mb-4 w-full"
      >
        <input
          id="question"
          className="bg-white border border-tertiary rounded hocus:ring-secondary hocus:border-secondary block w-full p-2.5"
          placeholder="Ask a question"
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          className="bg-primary hocus:bg-secondary hocus:ring-2 hocus:outline-none hocus:ring-primary rounded sm:w-auto px-5 flex justify-center items-center disabled:opacity-50 disabled:pointer-events-none"
          // Disabled the button if no prompt is typed.
          disabled={!prompt || loading}
        >
          <Send className="h-5 w-5 stroke-white" />
        </button>
      </form>
    </div>
  );
}
