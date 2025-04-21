#!/bin/bash

# RIA25 Documentation cross-reference update script
# Created: April 30, 2024

# Directory containing the documentation files
DOCS_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation/specification"

# Check if the directory exists
if [ ! -d "$DOCS_DIR" ]; then
  echo "Error: Directory $DOCS_DIR not found"
  exit 1
fi

# Record changes in a log file
LOG_FILE="$(dirname "$DOCS_DIR")/update_references_log.txt"
echo "Cross-reference updates performed on $(date)" > "$LOG_FILE"

# Process each file
echo "Updating cross-references in all Markdown files..."
for file in "$DOCS_DIR"/*.md; do
  filename=$(basename "$file")
  echo "Processing $filename"
  echo "File: $filename" >> "$LOG_FILE"
  
  # Create backup
  cp "$file" "${file}.bak"
  
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
  
  # Also update dashes in filenames for consistency
  sed -i '' 's/vercel-deployment-guide/vercel_deployment_guide/g' "$file"
  
  # Check if any changes were made
  if cmp -s "$file" "${file}.bak"; then
    echo "  No changes made" >> "$LOG_FILE"
    rm "${file}.bak"
  else
    echo "  Updated cross-references" >> "$LOG_FILE"
    echo "  (Backup saved as ${filename}.bak)"
  fi
done

echo "Cross-reference updates complete. See $LOG_FILE for details."
echo ""
echo "IMPORTANT: This script has created backups of modified files with .bak extension."
echo "You may want to review the changes and remove the backup files once satisfied."
echo ""
echo "Next steps:"
echo "1. Update documentation_map.md to reflect the new file names"
echo "2. Update generate_documentation.sh to use the new file pattern"
echo "3. Test the documentation generation with the updated files" 