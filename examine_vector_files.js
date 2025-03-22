// examine_vector_files.js
// Script to examine vector files for 2025 references
require("dotenv").config();
const { OpenAI } = require("openai");

// Initialize the OpenAI client with the API key from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

async function examineVectorFiles() {
  try {
    console.log(`Examining files in vector store: ${vectorStoreId}`);

    // List all files in the vector store
    const result = await openai.vectorStores.files.list(vectorStoreId);
    const files = result.data;

    console.log(`Found ${files.length} files in the vector store`);

    // Since we can't directly examine file contents with the API,
    // let's try to use a search to find files that might contain 2025 references
    console.log('\nSearching for "2025" references...');

    const searchQuery = "2025";
    const searchResponse = await openai.vectorStores.query(vectorStoreId, {
      query: searchQuery,
      maxResults: 10,
    });

    console.log(
      `Search returned ${searchResponse.matches.length} matches for "2025"`
    );

    if (searchResponse.matches.length > 0) {
      console.log("\nMatched content:");
      searchResponse.matches.forEach((match, index) => {
        console.log(`${index + 1}. Score: ${match.score}`);
        console.log(`   Text: ${match.text?.substring(0, 200)}...`);
        if (match.file_id) {
          console.log(`   File ID: ${match.file_id}`);
        }
        console.log("---");
      });
    }

    // Ask the user if they want to delete the entire vector store
    console.log(
      "\nSince we cannot reliably identify which files contain 2025 data,"
    );
    console.log(
      "would you like to delete the entire vector store and recreate it?"
    );
    console.log("This would remove all files, not just 2025 data.");
    console.log("To do this, you would need to:");
    console.log("1. Delete the vector store using the OpenAI dashboard");
    console.log("2. Create a new vector store with the same ID");
    console.log("3. Re-upload the files you want to keep");
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("API response:", error.response.data);
    }
  }
}

// Run the function
examineVectorFiles();
