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
        title="About This Project"
        icon={<AboutProject />}
        defaultOpen={false}
      >
        <div className="text-sm text-tertiary">
          <p className="mb-2">
            Korn Ferry's Workforce 2025 survey provides insights from ten global
            markets including the US, UK, India, France, Germany, Japan, UAE,
            Brazil, Saudi Arabia, and Australia.
          </p>
          <p>
            The RIA25 project provides access to this dataset via an AI
            assistant that helps business leaders explore workplace trends
            through natural conversation, enabling organisations to make
            informed talent decisions based on what today's global workforce
            truly values.
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
            Try asking: "What are the top priorities for millennials in the
            workplace?" or "How do attitudes toward AI differ across regions?"
          </p>
          <p className="text-sm text-secondary mt-1">
            The assistant will provide insights based on the comprehensive
            Workforce 2025 Survey data.
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
          <p className="mb-2">
            RIA is a Next.js web application that delivers real-time insights
            from the global Workforce 2025 Survey through an AI-powered chatbot
            interface.
          </p>
          <p className="mb-2">
            The system analyzes survey data from 10 international markets (US,
            UK, India, France, Germany, Japan, UAE, Brazil, Saudi Arabia, and
            Australia) to help business leaders understand workforce trends.
          </p>
          <p className="mb-2">
            Behind the scenes, RIA processes structured data files containing
            responses across various questions, from career preferences to
            attitudes about AI adoption. The system includes robust testing
            protocols to ensure accuracy, reliability, and compliance with
            privacy standards before deployment on the Korn Ferry website.
          </p>
          <p>
            The platform enables users to explore workforce insights through
            natural conversation rather than complex data tables, making
            powerful analytics accessible to business leaders without technical
            expertise.
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
            While our AI assistant draws from carefully analyzed Workforce 2025
            Survey data spanning 10 global markets, please note that responses
            may occasionally contain inaccuracies. The system interprets
            questions using natural language processing which, like all AI
            technologies, isn't perfect. Data insights are provided for
            informational purposes only and should be verified through
            additional sources when making business decisions. If you receive
            information that seems inaccurate, please rephrase your question or
            ask for clarification.
          </p>
        </div>
      </CollapsibleBlock>
    </div>
  );
}
