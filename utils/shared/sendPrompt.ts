import { track } from "@vercel/analytics";

export interface SendPromptContext {
  prompt: string;
  setPrompt: (text: string) => void;
  setLoading: (value: boolean) => void;
  setStreamingMessage: (msg: any) => void;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setThreadId: (id: string) => void;
  getCachedFilesForThread: (threadId: string) => { fileIds: string[] };
  updateThreadCache: (
    threadId: string,
    newFileIds: string[],
    newData: any
  ) => void;
  messageId: React.MutableRefObject<number>;
  accumulatedText: React.MutableRefObject<string>;
  scrollToBottom: () => void;
  loading: boolean;
  assistantId: string;
}

export const createSendPrompt = (ctx: SendPromptContext) => {
  return async (threadId?: string, immediateQuestion?: string) => {
    const {
      prompt,
      setPrompt,
      setLoading,
      setStreamingMessage,
      setMessages,
      setThreadId,
      getCachedFilesForThread,
      updateThreadCache,
      messageId,
      accumulatedText,
      scrollToBottom,
      loading,
      assistantId,
    } = ctx;

    const questionText = immediateQuestion || prompt || "";
    if (!questionText.trim()) return;
    track("Question", { question: questionText });
    if (!immediateQuestion) setPrompt("");
    setLoading(true);
    setStreamingMessage({
      id: "processing",
      role: "assistant",
      content: "<span class='loading-message'>Understanding your question...</span>",
      createdAt: new Date(),
      stage: "querying",
    });

    const loadingStages = [
      { stage: "retrieving", message: "Searching through workforce survey data..." },
      { stage: "analyzing", message: "Examining trends and statistics..." },
      { stage: "processing", message: "Identifying key patterns in the data..." },
      { stage: "connecting", message: "Connecting insights across demographics..." },
      { stage: "finalizing", message: "Formulating a comprehensive answer..." },
    ];

    let currentStage = 0;
    const intervalRef: { current: NodeJS.Timeout | null } = { current: null };
    intervalRef.current = setInterval(() => {
      if (!loading) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      if (currentStage < loadingStages.length && loadingStages[currentStage]) {
        setStreamingMessage((prev: any) => ({
          ...prev,
          content: `<span class='loading-message'>${loadingStages[currentStage].message}</span>`,
          stage: loadingStages[currentStage].stage,
        }));
        currentStage = (currentStage + 1) % loadingStages.length;
      }
    }, 4000);

    messageId.current += 1;
    const msgId = messageId.current;
    let userMessageContent = questionText;
    try {
      const cachedFiles = threadId ? getCachedFilesForThread(threadId) : { fileIds: [] };
      setStreamingMessage((prev: any) => ({
        ...prev,
        content: `<span class='loading-message'>Retrieving data...</span>`,
        stage: "retrieving",
      }));
      const dataRetrievalResponse = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: questionText,
          context: "all-sector",
          cachedFileIds: cachedFiles.fileIds,
        }),
      });
      if (!dataRetrievalResponse.ok) {
        setStreamingMessage((prev: any) => ({
          ...prev,
          content: `<span class='loading-message'>Data retrieval failed with status ${dataRetrievalResponse.status}</span>`,
          stage: "error",
        }));
        throw new Error(`Data retrieval failed with status ${dataRetrievalResponse.status}`);
      }
      const dataResult = await dataRetrievalResponse.json();
      if (dataResult.naturalLanguageQuery) {
        userMessageContent = dataResult.naturalLanguageQuery;
      }
      setMessages((prev: any[]) => [
        ...prev,
        { id: msgId.toString(), role: "user", content: userMessageContent, createdAt: new Date() },
      ]);
      let assistantPromptQuestion = userMessageContent;
      if (dataResult.out_of_scope) {
        const outOfScopeMessage = {
          role: "assistant",
          content: dataResult.out_of_scope_message ||
            "Sorry, your query is outside the scope of what I can answer.",
          id: `out-of-scope-${Date.now()}`,
          createdAt: new Date(),
        };
        setMessages((prev: any[]) => [...prev, outOfScopeMessage]);
        setStreamingMessage(null);
        setLoading(false);
        clearInterval(intervalRef.current!);
        return;
      }
      if (dataResult.error) {
        setStreamingMessage((prev: any) => ({
          ...prev,
          content: `I'm sorry, I encountered an error retrieving the relevant data: ${dataResult.error}`,
          stage: "error",
        }));
        setLoading(false);
        clearInterval(intervalRef.current!);
        return;
      }
      if (dataResult && dataResult.status === "error_no_context") {
        const errorMessage = {
          role: "assistant",
          content: `I need some context first. ${dataResult.error ||
            "Please ask me a question about workforce trends before requesting content transformations like articles or summaries."}`,
          id: `error-${Date.now()}`,
          createdAt: new Date(),
        };
        setMessages((prev: any[]) => [...prev, errorMessage]);
        setStreamingMessage(null);
        setLoading(false);
        clearInterval(intervalRef.current!);
        return;
      }
      if (threadId && dataResult?.file_ids && dataResult.file_ids.length > 0) {
        const newFileIds = dataResult.file_ids as string[];
        const newData = { raw_data: dataResult.raw_data };
        updateThreadCache(threadId, newFileIds, newData);
      }
      setStreamingMessage((prev: any) => ({
        ...prev,
        content: `<span class='loading-message'>Generating insights...</span>`,
        stage: "analyzing",
      }));
      const assistantPrompt = dataResult?.statsPreview
        ? `
Query: ${assistantPromptQuestion}

Analysis Summary: ${dataResult?.analysis || "No analysis available"}

Sector Data:
${dataResult.statsPreview}
`
        : `
Query: ${assistantPromptQuestion}

Analysis Summary: ${dataResult?.analysis || "No analysis available"}

${dataResult?.files_used ? `Files Used: ${dataResult.files_used.join(", ")}` : ""}
${dataResult?.data_points ? `Data Points: ${dataResult.data_points}` : ""}
${dataResult?.status ? `Status: ${dataResult.status}` : ""}

${dataResult?.raw_data ? `Raw Survey Data:
\`\`\`json
${typeof dataResult.raw_data === "string" ? dataResult.raw_data : JSON.stringify(dataResult.raw_data, null, 2)}
\`\`\`
` : "NO RAW DATA AVAILABLE"}
`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        throw new Error("Assistant API request timed out after 30 seconds");
      }, 30000);
      try {
        const assistantResponse = await fetch("/api/chat-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assistantId, threadId, content: assistantPrompt }),
          signal: controller.signal,
        });
        const processingUpdateTimeout = setTimeout(() => {
          if (loading) {
            setStreamingMessage((prev: any) => ({
              ...prev,
              content: `<span class='loading-message'>Processing complex data patterns and preparing your answer...</span>`,
              stage: "finalizing",
            }));
          }
        }, 5000);
        clearTimeout(timeoutId);
        clearTimeout(processingUpdateTimeout);
        if (!assistantResponse.ok) {
          try {
            const errorData = await assistantResponse.json();
            if (errorData.error_type === "out_of_scope") {
              setStreamingMessage((prev: any) => ({
                ...prev,
                stage: "error",
                content: `<span class='error-message'>${errorData.message ||
                  "I'm sorry, but that appears to be outside the scope of what I can help with based on the available data."}</span>`,
              }));
            } else {
              setStreamingMessage((prev: any) => ({
                ...prev,
                stage: "error",
                content: `<span class='error-message'>${errorData.message ||
                  "Error contacting AI assistant. Please try again later."}</span>`,
              }));
            }
          } catch (e) {
            setStreamingMessage((prev: any) => ({
              ...prev,
              stage: "error",
              content: `<span class='error-message'>Error contacting AI assistant. Please try again later.</span>`,
            }));
          }
          throw new Error(`API response not OK: ${assistantResponse.status} ${assistantResponse.statusText}`);
        }
        if (!assistantResponse.body) {
          throw new Error("No response body received");
        }
        const reader = assistantResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        accumulatedText.current = "";
        const processEvents = async (chunk: string) => {
          buffer += chunk;
          const textDeltaRegex = /event: textDelta\ndata: ({.*?})\n\n/g;
          let match: RegExpExecArray | null;
          while ((match = textDeltaRegex.exec(buffer)) !== null) {
            try {
              const eventData = JSON.parse(match[1]);
              if (eventData.value) {
                accumulatedText.current += eventData.value;
                setStreamingMessage({
                  id: "streaming",
                  role: "assistant",
                  content: accumulatedText.current,
                  createdAt: new Date(),
                });
              }
            } catch (e) {
              console.error("Error processing text delta:", e);
            }
          }
          const messageDoneRegex = /event: messageDone\ndata: ({.*?})\n\n/g;
          let doneMatch: RegExpExecArray | null;
          while ((doneMatch = messageDoneRegex.exec(buffer)) !== null) {
            try {
              const eventData = JSON.parse(doneMatch[1]);
              if (eventData.threadId) {
                setThreadId(eventData.threadId);
              }
              const finalContent = eventData.content || accumulatedText.current || "";
              messageId.current++;
              setMessages((prev: any[]) => [
                ...prev,
                { id: messageId.current.toString(), role: "assistant", content: finalContent, createdAt: new Date(eventData.createdAt || Date.now()) },
              ]);
              setLoading(false);
              setStreamingMessage(null);
              accumulatedText.current = "";
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
              }
              setTimeout(scrollToBottom, 100);
            } catch (e) {
              console.error("Error processing message done:", e);
            }
          }
          const errorRegex = /event: error\ndata: ({.*?})\n\n/g;
          let errorMatch: RegExpExecArray | null;
          while ((errorMatch = errorRegex.exec(buffer)) !== null) {
            try {
              const eventData = JSON.parse(errorMatch[1]);
              messageId.current++;
              setMessages((prev: any[]) => [
                ...prev,
                { id: messageId.current.toString(), role: "assistant", content: `I apologize, but I encountered an error: ${eventData.message || eventData.error || "Unknown error"}`, createdAt: new Date() },
              ]);
              setLoading(false);
              setStreamingMessage(null);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
              }
              setTimeout(scrollToBottom, 100);
            } catch (e) {
              console.error("Error processing error event:", e);
            }
          }
          const lastCompleteEvent = buffer.lastIndexOf("\n\n");
          if (lastCompleteEvent > 0) {
            buffer = buffer.substring(lastCompleteEvent + 2);
          }
        };
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            await processEvents(decoder.decode(value, { stream: true }));
          }
        } catch (streamError) {
          messageId.current++;
          setMessages((prev: any[]) => [
            ...prev,
            { id: messageId.current.toString(), role: "assistant", content: "I apologize, but I encountered an issue with the connection. Please try again.", createdAt: new Date() },
          ]);
          setLoading(false);
          setStreamingMessage(null);
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(scrollToBottom, 100);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        let errorMessage = "I apologize, but I encountered an issue while processing your request.";
        if ((error as any).name === "AbortError") {
          errorMessage = "I apologize for the delay. Your request took longer than expected to process. Please try asking a more specific question or try again later.";
        } else if ((error as any).message?.includes("network") || (error as any).message?.includes("fetch")) {
          errorMessage = "I'm having trouble connecting to the server. Please check your internet connection and try again.";
        } else if ((error as any).message?.includes("API")) {
          errorMessage = "I'm experiencing some temporary technical difficulties. Our team has been notified and is working to resolve this. Please try again in a few minutes.";
        }
        messageId.current++;
        setMessages((prev: any[]) => [
          ...prev,
          { id: messageId.current.toString(), role: "assistant", content: errorMessage, createdAt: new Date() },
        ]);
        setLoading(false);
        setStreamingMessage(null);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      messageId.current++;
      setMessages((prev: any[]) => [
        ...prev,
        { id: messageId.current.toString(), role: "assistant", content: "Sorry, an error occurred while sending your request.", createdAt: new Date() },
      ]);
      setLoading(false);
      setStreamingMessage(null);
      setTimeout(scrollToBottom, 100);
    }
  };
};
