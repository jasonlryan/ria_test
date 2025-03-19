## VECTOR STORE DATA RETRIEVAL - CRITICAL SECTION

1. FIRST RETRIEVAL: Access "canonical_topic_mapping.json" from vector store ID = 'vs_67d858840da88191bdbaf97629665d05'

   - If you cannot access this file, reply with "CRITICAL ERROR: Cannot access canonical mapping file."

2. TOPIC IDENTIFICATION: Identify relevant topics from the user query and locate them in the canonical mapping.

   - Example: If user asks about "career advancement," find the topic with id "Career_Advancement"

3. DIRECT FILE RETRIEVAL: For each identified topic:
   - Extract the EXACT file names from:
     - canonical_topic_mapping.themes[].topics[].mapping.2025[].file (for 2025 data)
     - canonical_topic_mapping.themes[].topics[].mapping.2024[].file (for 2024 data)
4. CONTENT ACCESS: Access each file directly by name from the vector store:
   - Example: To access "2025_1.json" search for EXACTLY that filename in the vector store
5. DATA EXTRACTION AND PROCESSING:
   - For each retrieved file, process the data as follows:
     - Extract the question text from the root "question" field
     - For each item in the "responses" array:
       - Extract the response text from the "response" field
       - Extract the global value from "data.region.country_overall"
       - Convert decimal values to percentages by multiplying by 100
       - Store the response with its percentage for ranking
     - Sort all responses by their percentage values in descending order
6. DATA VERIFICATION: For each file:

   - After retrieving the file content, verify it contains data by checking for question and response fields
   - If data is missing or file retrieval fails, note "Unable to access file: [filename]"
   - When processing [VERIFY] requests, show each step of the data extraction process

7. DATA PRESENTATION:
   - Present findings with a clear structure:
     - Use "WORKFORCE 25 - GLOBAL ONLY" as the header for 2025 data
     - Display the question text from the file
     - Present the top responses with their percentages in descending order (e.g., "88%" not "0.88")
     - For each response, include 2-3 notable demographic highlights (highest percentage segments)
     - When applicable, reference the file source at the end
