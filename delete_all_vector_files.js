// delete_all_vector_files.js
// Script to delete all files from the OpenAI vector store
require("dotenv").config();
const { OpenAI } = require("openai");

// Initialize the OpenAI client with the API key from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

async function deleteAllVectorFiles() {
  try {
    console.log(`Deleting all files from vector store: ${vectorStoreId}`);

    // List all files in the vector store
    const result = await openai.vectorStores.files.list(vectorStoreId);
    const files = result.data;

    console.log(`Found ${files.length} files in the vector store`);

    // Delete each file
    let deletedCount = 0;
    for (const file of files) {
      try {
        await openai.vectorStores.files.delete(vectorStoreId, file.id);
        console.log(`Deleted file ID: ${file.id}`);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting file ${file.id}:`, error.message);
      }
    }

    console.log(
      `\nSuccessfully deleted ${deletedCount} out of ${files.length} files`
    );
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("API response:", error.response.data);
    }
  }
}

// Run the function
deleteAllVectorFiles();
