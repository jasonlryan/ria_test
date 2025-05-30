import React, { useEffect, useRef, KeyboardEvent } from "react";

import Send from "./icons/Send";
import { useSearchParams } from "next/navigation";

export default function PromptInput({
  prompt,
  setPrompt,
  sendPrompt,
  threadId,
  loading,
}: {
  prompt: string;
  setPrompt: (prompt: string) => void;
  sendPrompt: (threadId?: string, prompt?: string) => void;
  threadId: string;
  loading: boolean;
}) {
  // Remove local click/mount tracking – we will send the prompt directly on submit.

  // Check if a question has been passed in the URL, if so, run the question
  const searchParams = useSearchParams();
  const question = searchParams.get("question");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea after response is received (loading goes from true to false)
  const prevLoadingRef = useRef(loading);
  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      // loading transitioned from true to false
      textareaRef.current?.focus();
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  // Auto run a starter question passed via the URL
  useEffect(() => {
    if (!question) return;
    setPrompt(question);
    // fire once after initial render
    // We call sendPrompt directly rather than relying on state side-effects to avoid duplicates.
    sendPrompt(threadId, question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  // Handle keyboard events to support SHIFT+RETURN for new line
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      // If SHIFT+ENTER, allow adding a new line
      if (e.shiftKey) {
        return; // Default behavior will add a line break
      }
      // If just ENTER without shift, submit the form
      e.preventDefault();
      handleSubmit();
    }
  };

  // Unified submit handler to avoid duplicate prompt dispatches
  const handleSubmit = () => {
    // If assistant is still producing a response, submitting now may be ignored by parent logic.
    const currentPrompt = prompt.trim();
    if (!currentPrompt) return;
    sendPrompt(threadId, currentPrompt);
    setPrompt("");
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        className="relative"
      >
        <textarea
          ref={textareaRef}
          id="question"
          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border-2 border-tertiary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors text-sm sm:text-base resize-none overflow-y-auto"
          placeholder="Ask RIA about the Workforce 2025 Survey... (Press SHIFT+RETURN for new line)"
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          style={{ minHeight: "80px", maxHeight: "300px" }}
        />
        <button
          type="submit"
          className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 bg-primary text-white p-1.5 sm:p-2 rounded-full hover:bg-secondary transition-colors disabled:opacity-50 disabled:hover:bg-primary"
          disabled={!prompt}
        >
          <Send className="h-4 w-4 sm:h-5 sm:w-5 stroke-current" />
        </button>
      </form>
    </div>
  );
}
