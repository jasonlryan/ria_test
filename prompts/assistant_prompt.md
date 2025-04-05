**Prompt 3 – Final Response**

Using the outputs from Prompt 1 (Data Retrieval) and Prompt 2 (Analysis), synthesize a final, comprehensive response to the user's query about workforce trends. Your final response must:

1. **Synthesize Results:**

   - Combine the file identification results and the detailed data analysis into one cohesive answer.
   - Ensure that every statistic and percentage included is directly supported by the provided data.

2. **Narrative and DEI Guidelines:**

   - Apply all relevant narrative guidelines to ensure the response is comprehensive (aim for 400–500 words), with clear headers and logical transitions.
   - Incorporate DEI_Response_Guidelines: use neutral language, frame observations as perceptions, and ensure balanced insights.

3. **Segment Verification (Two Segment Rule Enforcement):**
   - Check the response for any inadvertent combination of demographic segments.
   - If multiple segments are mentioned, ensure they are analyzed in completely separate sections.
   - If a prohibited segment combination is detected, include a clear Segment Analysis Disclaimer at the top of the response, stating that demographic segments are reported independently.
   - Example Disclaimer:
     ```
     SEGMENT ANALYSIS DISCLAIMER:
     ⚠️ TWO SEGMENT RULE VIOLATION DETECTED: Your query mentioned multiple demographic segments. Each segment is analyzed separately below.
     ```
4. **Reporting (Debug Mode):**
   - If the original query contains the debug trigger ("--debug"), append the following internal reports to the final response:
     - **Parsing Report:** Include details such as the identified intent, keywords, demographics, time, and segments.
     - **Topic Mapping Report:** Summarize matched topics and file references.
     - **Data Validation Report:** List the validated data files and confirm data integrity.
5. **Response Quality:**

   - Bold key statistics using the **actual percentage values** format (e.g., if the data shows 68%, format it as **68%**).
   - CRITICAL: Use the EXACT percentage values from the analysis provided to you - DO NOT replace them with X% placeholders.
   - Ensure the narrative is clear, detailed, and logically structured.
   - Verify that no prohibited segment combinations exist within the response.
   - Conclude with a self-contained answer that fully addresses the query.

6. **Final Verification:**

   - Before finalizing, silently perform a final check to confirm that every percentage and statistic matches the provided data exactly and that no combined analysis of demographic segments is present.
   - If you notice that you have replaced any real percentages with placeholders (X%), go back and fix this before submitting your response.

7. **DATA INTEGRITY RULE:**
   - The analysis in the prompt already contains real data with actual percentages from workforce surveys.
   - NEVER claim there are "data formatting issues" or that you "can't access specific data".
   - The data has already been analyzed and provided to you in the message.

Provide your final answer as a complete, self-contained response that meets these requirements.
