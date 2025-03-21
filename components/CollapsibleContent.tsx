import React from "react";
import CollapsibleBlock from "./CollapsibleBlock";
import ConversationStarter from "./icons/ConversationStarter";
import AboutProject from "./icons/AboutProject";
import DemoScenario from "./icons/DemoScenario";
import TechnicalDetails from "./icons/TechnicalDetails";
import ImportantDisclaimer from "./icons/ImportantDisclaimer";
import chatConfig from "../config/chat.config.json";

export default function CollapsibleContent({ handleStarterQuestion, loading }) {
  return (
    <div className="flex flex-col gap-3 lg:w-80">
      {/* Conversation Starters */}
      <CollapsibleBlock
        title="Conversation Starters"
        icon={<ConversationStarter />}
        defaultOpen={true}
      >
        <div className="flex flex-col gap-2.5">
          {chatConfig.starterQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleStarterQuestion(question.text)}
              disabled={loading}
              className="text-left px-3 py-2.5 bg-white border border-secondary rounded-md hover:bg-gray-50 transition-colors text-sm flex items-start"
            >
              <span className="text-yellow-500 mr-2 mt-0.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                </svg>
              </span>
              {question.text}
            </button>
          ))}
        </div>
      </CollapsibleBlock>

      {/* About This Project */}
      <CollapsibleBlock
        title="About This Project"
        icon={<AboutProject />}
        defaultOpen={false}
      >
        <div className="text-sm text-tertiary">
          <p>
            This chat interface provides insights from our comprehensive retail
            media data. Ask questions about marketing effectiveness, consumer
            behaviors, and budget allocations.
          </p>
        </div>
      </CollapsibleBlock>

      {/* Demo Scenario */}
      <CollapsibleBlock
        title="Demo Scenario"
        icon={<DemoScenario />}
        defaultOpen={false}
      >
        <div className="text-sm text-tertiary">
          <p>
            Try asking: "How should I allocate a $50,000 budget for pasta
            marketing in Italy?"
          </p>
          <p className="text-sm text-secondary mt-1">
            The assistant will provide a detailed breakdown based on marketing
            effectiveness data.
          </p>
        </div>
      </CollapsibleBlock>

      {/* Technical Details */}
      <CollapsibleBlock
        title="Technical Details"
        icon={<TechnicalDetails />}
        defaultOpen={false}
      >
        <div className="text-sm text-tertiary">
          <p>
            This assistant is powered by AI technology that analyzes retail
            media data to provide insights on marketing effectiveness and
            consumer behavior.
          </p>
        </div>
      </CollapsibleBlock>

      {/* Important Disclaimer */}
      <CollapsibleBlock
        title="Important Disclaimer"
        icon={<ImportantDisclaimer />}
        defaultOpen={false}
      >
        <div className="text-sm text-tertiary">
          <p>
            The recommendations provided are based on analysis of historical
            data and trends. Actual results may vary based on market conditions
            and other factors.
          </p>
        </div>
      </CollapsibleBlock>
    </div>
  );
}
