// list_vector_files.js
// Script to list all files in the OpenAI vector store
require("dotenv").config();
const { OpenAI } = require("openai");

// Initialize the OpenAI client with the API key from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

async function listVectorFiles() {
  try {
    console.log(`Listing all files in vector store: ${vectorStoreId}`);

    // List all files in the vector store
    const result = await openai.vectorStores.files.list(vectorStoreId);

    console.log(`Found ${result.data.length} files in the vector store`);

    // Display detailed information about each file
    if (result.data.length > 0) {
      console.log("\nFile details:");
      result.data.forEach((file, index) => {
        console.log(`${index + 1}. ID: ${file.id}`);
        console.log(`   Filename: ${file.filename}`);
        console.log(
          `   Created at: ${new Date(file.created_at * 1000).toLocaleString()}`
        );
        console.log("   Metadata:", file.metadata || "None");
        console.log("---");
      });
    } else {
      console.log("No files found in the vector store.");
    }
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("API response:", error.response.data);
    }
  }
}

// Run the function
listVectorFiles();
