const { identifyRelevantFiles } = require("../utils/openai/retrieval.js");

async function test() {
  const query =
    "Compare compensation satisfaction between 2024 and 2025 in the UK";
  const context = "";
  const isFollowUp = false;
  const previousQuery = "";
  const previousAssistantResponse = "";

  try {
    const result = await identifyRelevantFiles(
      query,
      context,
      isFollowUp,
      previousQuery,
      previousAssistantResponse
    );
    console.log("identifyRelevantFiles result:");
    console.dir(result, { depth: null });
  } catch (err) {
    console.error("Error running identifyRelevantFiles:", err);
  }
}

test();
