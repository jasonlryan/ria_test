Developer Briefing: Migrating from OpenAI Assistant API to Responses API in Node.js
Introduction and Context
Migrating a Node.js codebase from the OpenAI Assistant API (beta) to the new Responses API is an opportunity to improve architecture and embrace OpenAI’s latest features. The existing system uses two sequential OpenAI calls within a modular, multi-service architecture:
Query Parsing Call – The first call analyzes the user’s query and identifies relevant data files.
Report Generation Call – The second call uses the retrieved data and a refined prompt to produce a final report.
Our goal is to re-architect (not just do line-by-line substitution) to use the Responses API while preserving the two-step functionality and ensuring compatibility with the modular service design. This briefing outlines high-level design principles, a recommended architecture, pseudocode examples using the Responses API, key differences between the APIs (session state, function/tool calls, etc.), and testing strategies for a smooth end-to-end migration.
Why Move to the Responses API?
OpenAI’s Responses API is a unified interface that combines the capabilities of the older Chat Completions and Assistants API into a simpler, more flexible design
infoq.com
. Unlike the Assistants API (which required setting up assistant definitions and managing multi-step orchestration manually), the Responses API allows complex, multi-step tasks with tools in a single call if desired
infoq.com
. It also introduces built-in tools for web search, file search, and even operating a computer, and offers improvements like unified request format and improved streaming
infoq.com
. In short, the Responses API is now the primary way to interact with OpenAI models for new projects
github.com
, and the Assistants API is expected to be deprecated in the future
infoq.com
. Migrating ensures the codebase stays current and maintainable. Key Differences to Note:
Unified Request Structure: The Responses API uses a simpler schema with fields like instructions (system/developer guidance) and input (user prompt) instead of juggling role-based messages arrays. The output is returned as output_text (for text completions) or structured content, replacing the older choices array
github.com
.
State Management: The Responses API can manage conversation state for you if needed (via a previous_response_id to continue conversations)
cookbook.openai.com
. In contrast, the Assistant API required the developer to track context or use “sessions” manually. For one-off calls like our two-step flow, we can keep managing context in our code, but it’s good to know the new API offers a built-in stateful mode.
Function/Tool Calls: The Assistants API allowed defining tools and functions that the model could call. The Responses API still supports tool usage, but it simplifies this with built-in tools and structured events. You can specify tools (e.g., web_search or file_search) in the request, and the model will decide to invoke them internally
cookbook.openai.com
. This reduces manual orchestration – instead of handling a function call in multiple turns, the API can do it in one call. If you need custom tools or functions, you can still implement function calling logic by catching the model’s tool invocation events (or use the new Agents SDK for complex workflows). In our migration, we’ll preserve the explicit two-call flow (manual retrieval) for clarity and control, rather than using the built-in file search tool – but be aware this is an option.
Modality and Features: The new API is designed for multi-modal and multi-turn interactions. It’s more expressive – for example, it can handle more complex instructions and structured outputs (JSON) more easily. We should leverage this by instructing the model to return results in a structured format (when helpful), making parsing easier.
No Assistant Definition Files: If the old implementation used Assistant “files” or a predefined assistant ID (as in the beta), this concept is gone. Instead, each call provides all necessary context (instructions, tools, etc.) on the fly. This encourages a stateless, modular approach.
Understanding these differences will guide how we design the new solution.
High-Level Design Principles
When refactoring the codebase for the Responses API, keep these principles in mind:
Maintain Modular Boundaries: Preserve the separation of concerns across services. The “Query Parser” logic and “Report Generator” logic should remain distinct modules or services. This makes the system easier to extend or modify (for example, swapping out the query-analysis model or adding another preprocessing step) without affecting other parts.
Leverage the Responses API Simplicity: Use the new instructions and input fields to clearly delineate system instructions from user query. This will keep prompts clean and maintainable. Define high-level behavior (e.g. role, format of answer) in one place (the instructions) so it can be tweaked easily.
Preserve Flow and Functionality: The two-step call flow (analysis then generation) should remain logically the same. The first Responses API call should yield the identifiers of relevant files, and the second call should produce the final report using those files’ contents. Even if the new API could combine steps, we intentionally separate them to mirror the current behavior and maintain control over data usage.
Ensure Extensibility: Design the new architecture such that adding new features or swapping components is straightforward. For instance, if you later decide to use a vector database for file retrieval or add a caching layer for repeated queries, the modular design should accommodate this with minimal changes. Also, abstract the OpenAI integration behind service interfaces so that if in the future you need to replace OpenAI with another AI provider, it’s easier to do so.
Stateless Services (When Possible): Each service call should be self-contained, especially since the Responses API can hold state if asked but doesn’t require it. Our services will explicitly pass any needed context (like file content) to the next step rather than relying on hidden state. This makes the system easier to debug and test. (We avoid hidden session state unless we have a specific need for it.)
Robust Input/Output Handling: Because we are parsing model outputs (file lists, reports), ensure that the prompts are designed to yield easy-to-handle responses. For example, we can ask the model to output file names in a comma-separated list or JSON array. This reduces ambiguity when the result is consumed by the next module.
Recommended Modular Architecture
The new architecture will consist of distinct services or modules that mirror the two-step pipeline, with a clear interface between them. Below is a breakdown of the components:

1. Query Analysis Service (Step 1)
   Responsibility: Accepts the raw user query and determines which data files or resources are relevant. This service uses the OpenAI Responses API to parse or interpret the query. Implementation: This service will send the user’s question (and optionally a brief description or list of available files) to the model with instructions to select relevant files. It then returns a structured list of file identifiers. For example, the prompt (via instructions or included in input) might be: “You are a data assistant. The user’s question is given, along with titles of available data files. Identify which file names are most relevant to answer the question, and list them.” The output from the model should be parsed into an array of file IDs/names. Modularity: This service is self-contained – it doesn’t fetch file contents or generate answers, it only produces references. It could be an isolated microservice (with a REST API like /analyze-query) or a module within a larger service. By isolating it, we can adjust its prompt or model (e.g., use a faster, cheaper model here) independently. For instance, if we later maintain a mapping of keywords to files, we could augment or replace the AI call with a direct lookup inside this service.
2. Data Retrieval Module
   Responsibility: Given a list of relevant file IDs (from step 1), this module fetches the actual content of those files from wherever they are stored (database, filesystem, etc.). This is not an AI service per se, but an important part of the pipeline. Implementation: This could be a utility function or a separate microservice (if file storage is remote or encapsulated). It takes the file identifiers, retrieves the content (e.g., CSV data, text, JSON, etc.), and probably formats or truncates it as needed (to fit token limits). The output is a consolidated context that will be fed into the second AI call. Note: Ensure the retrieved data is in a suitable form for the model. If the files are large, consider summarizing or extracting only relevant parts before sending to OpenAI (to avoid hitting context length limits). This can be as simple as pulling an abstract or using embeddings to get relevant sections. The modular design means you can improve this retrieval step (such as adding a vector similarity search) without changing the surrounding logic.
3. Report Generation Service (Step 2)
   Responsibility: Takes the original user query and the content from relevant files, and produces the final answer or report via the Responses API. This is essentially the “answer synthesizer.” Implementation: This service composes a prompt that includes the necessary context (the retrieved data) and asks the model to generate a comprehensive answer. It will use a possibly more powerful model (e.g., GPT-4 or an gpt-4o variant) to ensure quality. The call will include instructions such as how to format the answer (e.g., as a report or JSON or bullet points) and the input which consists of the user’s question plus the provided data context. The model’s output_text is then returned to the user (or to the calling system). Modularity: Like the first service, this can be an independent microservice (e.g., /generate-report) or a module. It should not need to know how the data was obtained; it only requires that relevant context is provided to it. This separation means we could reuse this service for any scenario where we have some context and a question to answer (even if the context came from a different source, such as user-provided text).
4. Orchestration (Coordinator)
   If the above are separate services, an orchestrator component (which could be the backend API gateway or even the client application in some designs) will handle the flow: it calls the Query Analysis service with the user’s question, takes the resulting file list to the Data Retrieval module to get content, then calls the Report Generation service with the question + content. Finally, it returns the answer to the user. In a simpler deployment (e.g., a single Node.js server), this orchestration can be just a sequence of function calls within one request handler. The key is that the logic is still cleanly separated by function, even if not physically separate services. That makes testing and maintenance easier. CORS Consideration: Since the original system was CORS-enabled for front-end calls, ensure that whichever service the frontend interacts with (likely the orchestrator or API gateway) continues to send the proper CORS headers. The internal calls between services (if microservices are used) typically won’t require CORS, but the external-facing endpoint should remain accessible to the web client domain.
   Implementation with the Responses API
   With the architecture defined, let’s look at how to implement the two OpenAI calls using the new Responses API in Node.js. We will use pseudocode (TypeScript/JavaScript style) to illustrate the changes. The official OpenAI Node SDK (openai package) supports the Responses API, and we’ll utilize that. First, initialize the OpenAI API client (likely done once in each service or a shared module):
   import OpenAI from "openai";
   const openAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
   Step 1: Query Parsing with Responses API
   In the Query Analysis service, you’ll create a request to the Responses API. We use a concise prompt via instructions to set the role and expected behavior, and provide the user’s query (and possibly file list context) as input. For example:
   async function analyzeQuery(userQuery, availableFiles) {
   const instructions = "You are an assistant that helps pick relevant data files for a user query.";
   const inputPrompt =
   `User query: "${userQuery}"\n` +
   (availableFiles
   ? `Available files: ${availableFiles.join(", ")}\n`
   : "") +
   "List the file names (from the above) that are relevant to answering this query.";

const response = await openAIClient.responses.create({
model: "gpt-4o-mini", // e.g. a model suitable for quick analysis
instructions: instructions,
input: inputPrompt
});

const outputText = response.output_text;
// Expect outputText to be something like "FileA, FileC" or a JSON list, based on how we instructed it.
const filesIdentified = parseFilesFromOutput(outputText);
return filesIdentified; // e.g. ["FileA", "FileC"]
}
A few implementation notes for step 1:
We choose a model such as "gpt-4o-mini" for speed/cost efficiency in parsing the query. This model (hypothetical example) is part of the new lineup; ensure it exists or use another appropriate model (e.g., a GPT-3.5 equivalent in Responses API)
medium.com
medium.com
. The new model names in Responses API may differ from the old ones, so verify the available model IDs.
The instructions clearly define the assistant’s role (selecting relevant files). In the old Assistant API, this might have been done via a system message or a predefined assistant persona; now it’s an explicit field.
We include availableFiles in the prompt if we have that list. If the system had a fixed set of data files, you might pass their names or descriptions so the model can choose among them. This could also be done by prompting the model to ask for needed info, but since we already know the corpus, listing them is straightforward.
We ask the model to output just the file names. We could even instruct it to output JSON, e.g., Output the answer as a JSON array of filenames. This would simplify parseFilesFromOutput (which could then just do JSON.parse). Ensuring a structured output is a good practice with the Responses API since the models can reliably follow formatting instructions.
The result is parsed into a list of file identifiers. This list is then passed to the next stage.
If the old code used the Assistant API’s function calling to perform this step (for example, maybe the assistant had a searchFiles() tool it could call), the new approach replaces that by simply doing an AI completion. We are effectively doing manually what an “internal tool” might have done. The Responses API could handle this with the built-in file_search tool in one call, but we’re keeping the logic explicit for clarity. (Using the built-in tool would look like: providing tools: [{ type: "file_search" }] and the model might automatically retrieve content. We avoid that for now to maintain our controlled retrieval process.)
Step 2: Final Report Generation with Responses API
In the Report Generation service, we take the user’s query and the retrieved file contents to produce the answer. We will likely use a more capable model (for quality output) and provide detailed instructions.
async function generateReport(userQuery, filesContentMap) {
// Compose a context string from the files content
// Example: filesContentMap could be an object like { "FileA": "<content of FileA>", ... }
let contextText = "";
for (const [fileName, content] of Object.entries(filesContentMap)) {
// Optionally, truncate or summarize content if too long
contextText += `Content of ${fileName}:\n${content}\n\n`;
}

const instructions =
"You are a report-generating assistant. You will be given a user question and some reference data. " +
"Use the data to answer the question in detail. If multiple files are provided, synthesize information from all of them. " +
"Present the answer as a well-structured report.";

const inputPrompt =
`${contextText}\nUser question: ${userQuery}\n` +
"Answer the question using the above data. If certain details are in the data, incorporate them.";

const response = await openAIClient.responses.create({
model: "gpt-4o", // a more powerful model for generation
instructions: instructions,
input: inputPrompt
// (We could also enable streaming here with stream: true if needed for responsiveness)
});

return response.output_text; // Final report text
}
Notes for step 2:
We build contextText by concatenating the contents of each relevant file. In a real scenario, ensure this doesn’t exceed token limits. You might implement safeguards: e.g., limit each content to a certain length or pre-summarize if necessary. The modular design allows adding such preprocessing easily.
The instructions now set the stage for a detailed answer: note we define the role (“report-generating assistant”) and instruct on how to use the data. This was analogous to a system message and/or the function of the assistant in the old API. In the Assistant API, you might have had these instructions baked into the assistant’s configuration. Now, it’s just provided with each request, which is simpler and more explicit.
The inputPrompt includes all relevant context and the actual question. We first dump the content of files (with clear markers which file each snippet came from), then after that, we repeat the user’s question. This ordering is one way to do it; another approach is to state the question first and list data after, but typically the model will read it all regardless. We clearly separate the two with labels. The model will consider both the data and the question when formulating an answer.
We again use a model name appropriate for generation. For example, "gpt-4o" might be a variant of GPT-4 specialized for the Responses API (or you might use "gpt-4.5" if available, etc.). Ensure you consult OpenAI’s model list for the Responses API to choose the right one.
The call is made via openAIClient.responses.create just like before. We could request a streaming response by adding stream: true and then handling the stream events (the Responses API uses Server-Sent Events for streaming, providing tokens or semantic events). For initial migration, it’s fine to get the whole output_text directly; streaming can be an enhancement if the frontend needs to show typing answers.
The result is the final report text, which can be returned to the client.
Comparing to Assistant API logic: In the old approach, if the Assistant API maintained conversation state, you might have fed the file content as a follow-up user message or the assistant might have fetched it via a tool mid-conversation. Now, we’ve done that assembly manually and are sending a single prompt containing everything. This is straightforward and ensures the model has exactly the info it needs in one go. The Responses API call will internally handle all the completion work and just give us the final answer text (no need to parse a choices list as before).
Reusing Context vs. New Calls
One question is whether to link the two steps with the API’s stateful mechanism. For example, could we have made the second call by referencing the first call’s ID (previous_response_id)? In this case, probably not ideal: The first call’s output (file names) is not something the model said to the user; it’s an intermediate result for our system. It’s clearer to start a fresh prompt for the second call with the data. The stateful feature is more useful for multi-turn user conversations (e.g., user asks follow-up question continuing context). In our flow, treat the two calls as separate tasks. This avoids any inadvertent carry-over of the model’s internal state that’s not relevant to the final answer. We explicitly control what context goes into the second call – which is exactly the file content we fetched.
Pitfalls and Key Considerations
When migrating to the Responses API, keep the following in mind to avoid common pitfalls:
Session State & Continuations: As noted, the Responses API can maintain conversation state (so you don’t have to resend previous messages)
cookbook.openai.com
. However, in our use case we deliberately control state. Make sure not to rely on hidden state unless intended. For example, do not expect the second call to implicitly know the user’s question from the first call – it won’t unless you supply it. Each call should get all the info it needs. If in the future you implement multi-turn interactions (e.g., user asks a follow-up question that should use the previous answer), you can leverage previous_response_id to continue the conversation seamlessly
cookbook.openai.com
, but that’s outside the current two-call scope.
Function/Tool Calls Handling: If the old code utilized function calling (e.g., openai.ChatCompletion with function definitions for tools), be aware that the mechanism with Responses API is different. The new API will automatically decide to use a tool if you list it under tools. For example, we could list file_search as a tool and have the model fetch data itself
cookbook.openai.com
, or use web_search to answer questions with online information. This reduces manual steps but also moves some logic into the model’s control. For this migration, since we want to preserve the existing logic, we did not use automatic tools. If you were to integrate custom tools not provided by OpenAI, you would need to intercept the model’s request (likely via streaming events indicating a function call) and provide the function result, similar to how you handled function calls with the Assistant API. The difference is mainly that Responses API’s return object would include an event or output for the tool’s result rather than a second assistant message to parse. Test any function call flows carefully if you have them.
Output Structure Differences: The Responses API returns a simpler response object. In Node’s SDK, response.output_text holds the text output (assuming a text completion). This is more direct than dealing with response.choices[0].message.content as in the Chat Completions API. Adjust your code to use the new property. Also note that if you request structured output (like JSON), the Responses API might return it in a parsed form (depending on the SDK) or as text you still need to parse. Always consult the SDK docs – for example, multi-part outputs or tool usage might appear under response.output as structured content rather than a flat string. In our pseudocode, we treated everything as plain text for simplicity.
Model Compatibility: Some model IDs changed or new ones introduced for Responses API. Verify that the model you intend to use is available. For instance, if you previously used gpt-4, the analogous might be "gpt-4o" or "GPT-4.5" under the new API (these names are examples – check OpenAI’s documentation for exact model identifiers). Using an incorrect or deprecated model name will cause errors. Also note pricing or rate-limit changes if any for the new models.
Token Limits and Performance: Ensure the combined size of your prompts (instructions + input) and the expected answer fits within the model’s token limit. The second call, in particular, might send a lot of data (file contents). You may need to impose a limit on how much data to include. A good practice is to measure token lengths and perhaps prioritize the most relevant portions of files. The Responses API and models might have similar or higher capacity than the old ones, but it’s safer to be mindful. Also, consider using the Responses API’s ability to summarize or reason in multiple turns if the context is too large – although that introduces complexity beyond the straightforward port.
CORS and Networking: The change to the Responses API is mostly on the server side (backend calling OpenAI). The external API endpoints called by Node may have changed (e.g., different path or subdomain). The OpenAI Node SDK handles endpoint URLs internally, so just ensure you update to the latest SDK version. The frontend should not notice any difference, as it still calls your Node services. Just confirm that any changes in response format (if any) that eventually bubble out to the client are accounted for (e.g., if previously you returned a JSON with a certain structure, keep it consistent).
Error Handling: Verify error handling with the new API. The Responses API might return different error codes or message formats for things like rate limiting or invalid requests. Update your try/catch or promise rejections handling accordingly. For example, if the old code checked for a specific status in the error, ensure the new SDK surfaces it similarly. The OpenAI Node SDK allows setting timeouts or retries; consider using these to make the services robust to transient failures
youtube.com
.
Streaming Behavior: If your old implementation streamed responses to the client (perhaps via Server-Sent Events or websockets), you can implement streaming with the Responses API easily. The Node SDK supports an event emitter or async iterator on the response when stream: true
github.com
. Keep in mind that streaming in the Responses API emits semantic events (e.g., tokens, tool events). For initial migration, you might not need to enable streaming; you can add it once basic functionality is confirmed. If you do add it, ensure that your front-end and routing supports the streaming properly (set the correct headers, flush partial data, etc.).
Testing Structured Outputs: If you ask the model to output JSON or a specific format in step 1 (or step 2), be prepared for occasional formatting errors (the model might not always produce perfect JSON if the prompt isn’t extremely explicit or if the content is tricky). You might need to implement a quick fix or fallback: e.g., if JSON parse fails, try to clean the string or run a regex to extract file names. During testing, check how reliable the outputs are. Often, adding a phrase like “If you are not sure, output an empty list” can help avoid the model going off-script.
Security and Data Handling: This is not a new issue with the Responses API per se, but remember to handle sensitive data carefully. If your data files contain sensitive info, they are being sent to the OpenAI model in step 2, which is similar to before – just ensure this aligns with privacy requirements. The Responses API by design doesn’t store data beyond 30 days (as of policy) and uses it for moderation, etc., similar to the older API usage. Reiterate any needed file content filtering to avoid accidental leakage (e.g., if the user query might ask for something not allowed or outside scope, have checks in place).
Testing and Validation Strategy
A thorough testing approach is vital to verify that the migration maintains the same end-to-end behavior:
Unit Test Each Module: Write tests for the Query Analysis function and the Report Generation function separately. You can simulate the OpenAI API calls by mocking the openAIClient.responses.create method. For example, test that a given sample query returns the expected file list (you might not get the exact same phrasing every time from the model, so this could be a bit tricky – consider using a fixed prompt and a stubbed response for deterministic testing). Similarly, test that given some sample file contents and a query, the generation function produces an answer that contains pieces of those contents (you might not assert the exact wording, but you can check that certain key facts or the structure is present).
Integration Testing: In a staging environment, run the full pipeline with the new implementation. Use a set of known queries for which you manually know which files should be picked and roughly what the answer should contain. This will validate that the two services are talking to each other correctly (the file list from step 1 indeed fetches the right data, and step 2 uses it). Pay attention to edge cases:
Query that matches no files (does the first model respond with an empty list or some indication? Ensure the second step handles it gracefully – perhaps by saying “No relevant data found for this query.”).
Query that matches many files (does the first model return a long list? Does the second step maybe hit context limit? This is where you might decide to limit to top 3 files or so in the instructions).
Extremely long user query or special characters (make sure nothing breaks formatting).
Regression Testing vs. Old System: If you have logs or records of the old system’s outputs for certain inputs, compare them to the new system’s outputs. They don’t have to be identical (the phrasing might differ), but they should be equivalent in functionality – i.e., they reference the same data and answer the question correctly. If there are discrepancies, analyze whether it’s due to prompt differences. You may need to tweak the instructions to get similar behavior. For example, if the old assistant had a certain style or included sources, ensure your instructions tell the new model to do that as well.
Performance Testing: Measure the response times for the two calls in the new setup. The Responses API should be efficient, but if you switched models or added more context, the latency might differ. Ensure it’s within acceptable range for user experience. If not, consider optimizations (like using a smaller model for step 2 if possible, or caching results of step 1 for repeated queries).
End-to-End User Acceptance: Finally, test from the user’s perspective via the front-end. Since the Node services are CORS-enabled, use the web app to issue some queries and observe the behavior. The results should appear coherent and complete. Verify that any formatting in the final report is correct (e.g., if the report should be in Markdown or contain certain sections, the new model output aligns with that format). The instructions can be adjusted to enforce output style (for instance, “provide the answer as bullet points” or “in JSON format”) if needed.
Throughout testing, iteratively refine the prompts (instructions and how you present the input). The model might require slight nudges to behave exactly like the old assistant. Keep these prompt definitions in a central place (maybe a JSON or config), so that they can be tuned without digging through code logic.
Conclusion
By adopting the OpenAI Responses API and following a clean modular architecture, the system will be well-structured for future growth. We preserved the two-step flow – Query Analysis and Report Generation – to maintain clarity and control, while leveraging the new API’s simpler interface and advanced capabilities. The new design isolates each concern (interpreting queries, retrieving data, generating answers) which improves maintainability and extensibility. When implementing, pay special attention to differences in how the new API handles state and tools, adjusting the code where necessary. Use the migration as an opportunity to strengthen the prompt design and output handling (for example, requesting structured outputs to reduce parsing ambiguity). After rigorous testing and validation, the new setup should replicate the original functionality end-to-end, with the added benefit of being on a more robust and future-proof API. The developer can now easily extend the system – for example, adding more tools (maybe integrating the built-in web_search for queries that need online info), or handling follow-up questions using the Responses API’s stateful features – without having to rework the core logic. By following this briefing’s guidelines, an AI developer should be well-equipped to carry out the migration in a systematic, confident manner, ensuring a smooth transition from the legacy Assistant API to the modern Responses API. Good luck with the migration! Sources:
OpenAI InfoQ News – “Responses API combines chat completions with assistant capabilities”
infoq.com
infoq.com
OpenAI Node.js SDK Documentation – Usage of Responses API (instructions & input fields)
github.com
github.com
OpenAI Cookbook – “Responses API is stateful (handles conversation history)”
cookbook.openai.com
, and tool usage example
cookbook.openai.com
.
Citations
Favicon
OpenAI Launches New API, SDK, and Tools to Develop Custom Agents - InfoQ

https://www.infoq.com/news/2025/03/openai-responses-api-agents-sdk/?utm_campaign=infoq_content&utm_source=infoq&utm_medium=feed&utm_term=global
Favicon
OpenAI Launches New API, SDK, and Tools to Develop Custom Agents - InfoQ

https://www.infoq.com/news/2025/03/openai-responses-api-agents-sdk/?utm_campaign=infoq_content&utm_source=infoq&utm_medium=feed&utm_term=global
Favicon
OpenAI Launches New API, SDK, and Tools to Develop Custom Agents - InfoQ

https://www.infoq.com/news/2025/03/openai-responses-api-agents-sdk/?utm_campaign=infoq_content&utm_source=infoq&utm_medium=feed&utm_term=global
Favicon
GitHub - openai/openai-node: Official JavaScript / TypeScript library for the OpenAI API

https://github.com/openai/openai-node
Favicon
OpenAI Launches New API, SDK, and Tools to Develop Custom Agents - InfoQ

https://www.infoq.com/news/2025/03/openai-responses-api-agents-sdk/?utm_campaign=infoq_content&utm_source=infoq&utm_medium=feed&utm_term=global
Favicon
GitHub - openai/openai-node: Official JavaScript / TypeScript library for the OpenAI API

https://github.com/openai/openai-node
Favicon
Web Search and States with Responses API | OpenAI Cookbook

https://cookbook.openai.com/examples/responses_api/responses_example
Favicon
Web Search and States with Responses API | OpenAI Cookbook

https://cookbook.openai.com/examples/responses_api/responses_example
Favicon
Learning Journey #1: Exploring the OpenAI Responses API with Node.js | by Alfian Yusuf Abdullah | Product Monday | May, 2025 | Medium

https://medium.com/product-monday/learning-journey-1-exploring-the-openai-responses-api-with-node-js-55786bfc1791
Favicon
Learning Journey #1: Exploring the OpenAI Responses API with Node.js | by Alfian Yusuf Abdullah | Product Monday | May, 2025 | Medium

https://medium.com/product-monday/learning-journey-1-exploring-the-openai-responses-api-with-node-js-55786bfc1791
Favicon
Web Search and States with Responses API | OpenAI Cookbook

https://cookbook.openai.com/examples/responses_api/responses_example
Favicon
How to stream OpenAI Assistants API v1 response in Python & Node ...

https://www.youtube.com/watch?v=d8dsFlLATrw
Favicon
GitHub - openai/openai-node: Official JavaScript / TypeScript library for the OpenAI API

https://github.com/openai/openai-node
