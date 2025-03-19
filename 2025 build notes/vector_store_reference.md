# WORKFORCE 24 Vector Store Reference

This document lists all files uploaded to the vector store for the WORKFORCE 24 survey assistant.

## Vector Store Details

- **ID:** vs_lMoDck4HDODRImvJIz1jVJ2A
- **Expiration Policy:** Never

## Uploaded Files

| File                               | Upload Date       |
| ---------------------------------- | ----------------- |
| supported_topics.json              | 27/10/2024, 11:07 |
| survey_information.json            | 09/10/2024, 08:06 |
| global_data.json                   | 09/10/2024, 07:46 |
| india_data.json                    | 09/10/2024, 07:37 |
| australia_data.json                | 09/10/2024, 07:37 |
| brazil_data.json                   | 09/10/2024, 07:37 |
| usa_data.json                      | 09/10/2024, 07:37 |
| uk_data.json                       | 09/10/2024, 07:37 |
| saudi_uae_data.json                | 09/10/2024, 07:37 |
| inferred_topics.json               | 08/10/2024, 21:16 |
| topics_to_avoid.json               | 08/10/2024, 21:16 |
| supported_topics.json              | 08/10/2024, 21:16 |
| Radically_Human_Tone_of_Voice.json | 08/10/2024, 21:02 |
| survey_questions.json              | 08/10/2024, 20:57 |
| Brazil_data.txt                    | 07/10/2024, 17:55 |
| USA_data.txt                       | 07/10/2024, 17:55 |
| Australia_data.txt                 | 07/10/2024, 17:55 |
| SaudiArabia_UAE_data.txt           | 07/10/2024, 17:55 |
| UK_data.txt                        | 07/10/2024, 17:55 |
| India_text.txt                     | 07/10/2024, 17:55 |

## File Categories

### Data Files

- Country-specific data in both JSON and TXT formats
- Global aggregated data

### Configuration Files

- `survey_questions.json` - Question definitions and mappings
- `survey_information.json` - General survey metadata and information

### Topic Management

- `supported_topics.json` - Topics directly addressed by the survey
- `inferred_topics.json` - Topics that can be inferred from survey data
- `topics_to_avoid.json` - Topics outside the scope of the survey

### Voice and Tone

- `Radically_Human_Tone_of_Voice.json` - Guidelines for response style and tone

## WORKFORCE 25 Planning Notes

For the WORKFORCE 25 implementation, we should create similar files with updated data:

1. Process all 2025 survey data into comparable JSON format
2. Create updated versions of all configuration files
3. Develop clear year labeling in filenames and/or metadata
4. Add comparison rules for year-over-year analysis
5. Upload all files to a new vector store with a clear naming convention

_Note: This document serves as a reference for building the 2025 vector store structure._
