import React, { useState, useEffect } from "react";
import CollapsibleBlock from "./CollapsibleBlock";
import ConversationStarter from "./icons/ConversationStarter";
import AboutProject from "./icons/AboutProject";
import TechnicalDetails from "./icons/TechnicalDetails";
import ImportantDisclaimer from "./icons/ImportantDisclaimer";
import chatConfig from "../config/chat.config.json";

export default function CollapsibleContent({ handleStarterQuestion, loading }) {
  // State to track if the mobile sheet is expanded - initially collapsed
  const [mobileExpanded, setMobileExpanded] = useState(false);
  // State to track if we're on mobile
  const [isMobile, setIsMobile] = useState(false);
  // State to track which block is currently open - always have conversation starters as the default open one
  const [openBlockId, setOpenBlockId] = useState("conversation-starters");

  // Detect mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };

    // Initial check
    checkMobile();

    // Set up listener for window resize
    window.addEventListener("resize", checkMobile);

    // Clean up
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close mobile sheet when a starter question is clicked
  const handleStarterQuestionClick = (question) => {
    handleStarterQuestion(question);
    if (isMobile) {
      setMobileExpanded(false);
    }
  };

  // Toggle a block open/closed
  const toggleBlock = (blockId) => {
    // If clicking the already open block, close it
    if (openBlockId === blockId) {
      setOpenBlockId("");
    } else {
      // Otherwise, close the current one and open the new one
      setOpenBlockId(blockId);
    }
  };

  // Helper function to render content paragraphs
  const renderContentParagraphs = (contentArray) => {
    return contentArray.map((paragraph, index) => (
      <p key={index} className={index < contentArray.length - 1 ? "mb-2" : ""}>
        {paragraph}
      </p>
    ));
  };

  return (
    <>
      {/* Mobile pull tab - only visible on small screens */}
      {isMobile && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-primary text-white p-2 rounded-t-lg shadow-lg z-30 flex justify-between items-center"
          onClick={() => setMobileExpanded(!mobileExpanded)}
        >
          <div className="flex items-center">
            <ConversationStarter className="w-5 h-5 mr-2" />
            <span className="font-medium">Conversation Starters</span>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className={`w-4 h-4 transition-transform ${
              mobileExpanded ? "transform rotate-180" : ""
            }`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>
      )}

      {/* Content container */}
      <div
        className={`
          flex flex-col gap-3 lg:w-80
          ${
            isMobile
              ? "fixed left-0 right-0 bottom-0 bg-white z-20 p-4 rounded-t-lg shadow-lg transition-transform duration-300 max-h-[85vh]"
              : ""
          }
          ${isMobile && !mobileExpanded ? "transform translate-y-full" : ""}
          ${isMobile && mobileExpanded ? "transform translate-y-0" : ""}
        `}
      >
        {/* Conversation Starters */}
        <CollapsibleBlock
          id="conversation-starters"
          title="Conversation Starters"
          icon={<ConversationStarter />}
          defaultOpen={!isMobile}
          isOpen={openBlockId === "conversation-starters"}
          onToggle={() => toggleBlock("conversation-starters")}
        >
          <div className="flex flex-col gap-2.5">
            {chatConfig.starterQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleStarterQuestionClick(question.text)}
                disabled={loading}
                className="text-left px-3 py-3 bg-white border border-secondary rounded-md hover:bg-gray-50 transition-colors text-sm flex items-start"
              >
                <span className="text-yellow-500 mr-2 mt-0.5 flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                  </svg>
                </span>
                <span className="leading-snug">{question.text}</span>
              </button>
            ))}
          </div>
        </CollapsibleBlock>

        {/* About This Project */}
        <CollapsibleBlock
          id={chatConfig.contentCards.aboutProject.id}
          title={chatConfig.contentCards.aboutProject.title}
          icon={<AboutProject />}
          defaultOpen={false}
          isOpen={openBlockId === chatConfig.contentCards.aboutProject.id}
          onToggle={() => toggleBlock(chatConfig.contentCards.aboutProject.id)}
        >
          <div className="text-sm text-tertiary">
            {renderContentParagraphs(
              chatConfig.contentCards.aboutProject.content
            )}
          </div>
        </CollapsibleBlock>

        {/* Technical Details */}
        <CollapsibleBlock
          id={chatConfig.contentCards.technicalDetails.id}
          title={chatConfig.contentCards.technicalDetails.title}
          icon={<TechnicalDetails />}
          defaultOpen={false}
          isOpen={openBlockId === chatConfig.contentCards.technicalDetails.id}
          onToggle={() =>
            toggleBlock(chatConfig.contentCards.technicalDetails.id)
          }
        >
          <div className="text-sm text-tertiary">
            {renderContentParagraphs(
              chatConfig.contentCards.technicalDetails.content
            )}
          </div>
        </CollapsibleBlock>

        {/* Important Disclaimer */}
        <CollapsibleBlock
          id={chatConfig.contentCards.importantDisclaimer.id}
          title={chatConfig.contentCards.importantDisclaimer.title}
          icon={<ImportantDisclaimer />}
          defaultOpen={false}
          isOpen={
            openBlockId === chatConfig.contentCards.importantDisclaimer.id
          }
          onToggle={() =>
            toggleBlock(chatConfig.contentCards.importantDisclaimer.id)
          }
        >
          <div className="text-sm text-tertiary">
            {renderContentParagraphs(
              chatConfig.contentCards.importantDisclaimer.content
            )}
          </div>
        </CollapsibleBlock>

        {/* Mobile closing button */}
        {isMobile && mobileExpanded && (
          <button
            onClick={() => setMobileExpanded(false)}
            className="mt-2 p-2 bg-gray-100 rounded-md text-sm text-gray-600 hover:bg-gray-200"
          >
            Close panel
          </button>
        )}
      </div>

      {/* Mobile overlay backdrop */}
      {isMobile && mobileExpanded && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={() => setMobileExpanded(false)}
        />
      )}
    </>
  );
}
