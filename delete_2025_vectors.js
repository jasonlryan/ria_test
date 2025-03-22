// delete_2025_vectors.js
// Script to delete all vectors with "2025" in their file IDs from OpenAI vector store
require("dotenv").config();
const { OpenAI } = require("openai");

// Initialize the OpenAI client with the API key from .env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

async function deleteVectors() {
  try {
    console.log(
      `Deleting vectors with "2025" in their metadata from vector store: ${vectorStoreId}`
    );

    // First query the vector store to find vectors with "2025" in their metadata
    const filePattern = "2025";

    const result = await openai.vectorStores.files.list(vectorStoreId);

    // Filter files that have 2025 in their name
    const files2025 = result.data.filter((file) => {
      return file.filename && file.filename.includes(filePattern);
    });

    console.log(`Found ${files2025.length} files with "2025" in their names`);

    // Delete each file from the vector store
    let deletedCount = 0;
    for (const file of files2025) {
      try {
        await openai.vectorStores.files.delete(vectorStoreId, file.id);
        console.log(`Deleted file: ${file.filename} (ID: ${file.id})`);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting file ${file.filename}:`, error.message);
      }
    }

    console.log(
      `Successfully deleted ${deletedCount} out of ${files2025.length} files`
    );
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("API response:", error.response.data);
    }
  }
}

// Run the function
deleteVectors();
