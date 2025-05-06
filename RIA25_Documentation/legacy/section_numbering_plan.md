# Section Numbering Update Plan

> **Created:** April 30, 2024

## Current Numbering Issues

The current documentation has several issues with its numbering scheme:

1. Files with letter suffixes (e.g., `03A_data_processing_workflow.md`, `03B_normalized_data_strategy.md`)
2. Inconsistent numbering patterns across documents
3. Difficulty in adding new documents in the correct sequence

## Proposed New Numbering Scheme

We will implement a clean sequential numbering system with two-digit numbers to allow for future additions. This will eliminate letter suffixes while maintaining a logical organization.

### Current vs. New Numbering

| Current Filename                             | New Filename                           | Category       |
| -------------------------------------------- | -------------------------------------- | -------------- |
| `00_README.md`                               | `00_README.md`                         | Overview       |
| `01_project_overview.md`                     | `01_project_overview.md`               | Overview       |
| `02_implementation_plan.md`                  | `02_implementation_plan.md`            | Overview       |
| `03A_data_processing_workflow.md`            | `03_data_processing_workflow.md`       | Data           |
| `03B_normalized_data_strategy.md`            | `04_normalized_data_strategy.md`       | Data           |
| `03C_2025_survey_questions_and_responses.md` | `05_survey_questions_and_responses.md` | Data           |
| `04_system_architecture.md`                  | `06_system_architecture.md`            | Architecture   |
| `05_ria25_prompt_evolution.md`               | `07_prompt_evolution.md`               | Architecture   |
| `06_vector_store_reference.md`               | `08_vector_store_reference.md`         | Architecture   |
| `07_development_timeline.md`                 | `09_development_timeline.md`           | Implementation |
| `08_testing_methodology.md`                  | `10_testing_methodology.md`            | Implementation |
| `09_vercel-deployment-guide.md`              | `11_vercel_deployment_guide.md`        | Implementation |
| `10_maintenance_procedures.md`               | `12_maintenance_procedures.md`         | Operations     |
| `11_canonical_topic_reference.md`            | `13_canonical_topic_reference.md`      | Reference      |
| `12_api_reference.md`                        | `14_api_reference.md`                  | Reference      |
| `13_thread_data_management.md`               | `15_thread_data_management.md`         | Reference      |
| `14_glossary.md`                             | `16_glossary.md`                       | Reference      |

## Implementation Steps

1. **File Renaming**

   - Create a script to rename the files according to the new scheme
   - Update the file headers with new document numbers
   - Preserve Last Updated dates

2. **Update Cross-References**

   - Scan all documents for references to other documents
   - Update these references to reflect the new numbering
   - Focus especially on "Related Documents" sections

3. **Update Documentation Map**

   - Update `documentation_map.md` to reflect the new numbering
   - Keep status information intact

4. **Update Documentation Generator**
   - Modify `generate_documentation.sh` to use the new file naming pattern

## Script for Renaming Files

The following script can be used to perform the renaming:

```bash
#!/bin/bash

# Directory containing the documentation files
DOCS_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation/specification"

# Associative array of old -> new filenames
declare -A file_map
file_map=(
  ["00_README.md"]="00_README.md"
  ["01_project_overview.md"]="01_project_overview.md"
  ["02_implementation_plan.md"]="02_implementation_plan.md"
  ["03A_data_processing_workflow.md"]="03_data_processing_workflow.md"
  ["03B_normalized_data_strategy.md"]="04_normalized_data_strategy.md"
  ["03C_2025_survey_questions_and_responses.md"]="05_survey_questions_and_responses.md"
  ["04_system_architecture.md"]="06_system_architecture.md"
  ["05_ria25_prompt_evolution.md"]="07_prompt_evolution.md"
  ["06_vector_store_reference.md"]="08_vector_store_reference.md"
  ["07_development_timeline.md"]="09_development_timeline.md"
  ["08_testing_methodology.md"]="10_testing_methodology.md"
  ["09_vercel-deployment-guide.md"]="11_vercel_deployment_guide.md"
  ["10_maintenance_procedures.md"]="12_maintenance_procedures.md"
  ["11_canonical_topic_reference.md"]="13_canonical_topic_reference.md"
  ["12_api_reference.md"]="14_api_reference.md"
  ["13_thread_data_management.md"]="15_thread_data_management.md"
  ["14_glossary.md"]="16_glossary.md"
)

# Rename files
for old_name in "${!file_map[@]}"; do
  new_name="${file_map[$old_name]}"
  if [ -f "$DOCS_DIR/$old_name" ]; then
    echo "Renaming $old_name to $new_name"
    git mv "$DOCS_DIR/$old_name" "$DOCS_DIR/$new_name"
  else
    echo "Warning: $old_name not found"
  fi
done

echo "File renaming complete"
```

## Script for Updating Cross-References

```bash
#!/bin/bash

# Directory containing the documentation files
DOCS_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation/specification"

# Process each file
for file in "$DOCS_DIR"/*.md; do
  echo "Processing $file"

  # Update cross-references
  sed -i '' 's/03A_data_processing_workflow/03_data_processing_workflow/g' "$file"
  sed -i '' 's/03B_normalized_data_strategy/04_normalized_data_strategy/g' "$file"
  sed -i '' 's/03C_2025_survey_questions_and_responses/05_survey_questions_and_responses/g' "$file"
  sed -i '' 's/04_system_architecture/06_system_architecture/g' "$file"
  sed -i '' 's/05_ria25_prompt_evolution/07_prompt_evolution/g' "$file"
  sed -i '' 's/06_vector_store_reference/08_vector_store_reference/g' "$file"
  sed -i '' 's/07_development_timeline/09_development_timeline/g' "$file"
  sed -i '' 's/08_testing_methodology/10_testing_methodology/g' "$file"
  sed -i '' 's/09_vercel-deployment-guide/11_vercel_deployment_guide/g' "$file"
  sed -i '' 's/10_maintenance_procedures/12_maintenance_procedures/g' "$file"
  sed -i '' 's/11_canonical_topic_reference/13_canonical_topic_reference/g' "$file"
  sed -i '' 's/12_api_reference/14_api_reference/g' "$file"
  sed -i '' 's/13_thread_data_management/15_thread_data_management/g' "$file"
  sed -i '' 's/14_glossary/16_glossary/g' "$file"
done

echo "Cross-reference updates complete"
```

## Testing Plan

After implementing the renaming:

1. Generate the full documentation using the updated `generate_documentation.sh`
2. Review the generated documentation for any broken references or links
3. Check each document header and related documents section
4. Verify the documentation map is correct

## Future Considerations

1. **Reserved Numbering Gaps**

   - We've created a sequential system without gaps
   - In the future, we may want to leave gaps (e.g., 10, 20, 30) to allow for easier insertion

2. **Categorization**

   - The new system still maintains implicit categories
   - Consider adding explicit category prefixes if needed (e.g., DATA-01, ARCH-01)

3. **GitHub Integration**
   - Ensure GitHub links are updated if documentation is referenced in issues or PRs

## Timeline

- Day 1: Create and review renaming plan
- Day 2: Implement file renaming and update cross-references
- Day 3: Test the changes and fix any issues
- Day 4: Update documentation map and generator script
- Day 5: Final review and deployment
