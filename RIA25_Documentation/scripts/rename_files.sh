#!/bin/bash

# RIA25 Documentation file renaming script
# Created: April 30, 2024

# Directory containing the documentation files
DOCS_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation/specification"

# Record changes in a log file
LOG_FILE="$(dirname "$DOCS_DIR")/rename_files_log.txt"
echo "File renaming performed on $(date)" > "$LOG_FILE"

# Simple file renaming using individual variables
rename_file() {
  local old_name="$1"
  local new_name="$2"
  if [ -f "$DOCS_DIR/$old_name" ]; then
    echo "Renaming $old_name to $new_name"
    echo "Renamed: $old_name -> $new_name" >> "$LOG_FILE"
    cp "$DOCS_DIR/$old_name" "$DOCS_DIR/$new_name"
  else
    echo "Warning: $old_name not found"
    echo "Not found: $old_name" >> "$LOG_FILE"
  fi
}

# Check if the directory exists
if [ ! -d "$DOCS_DIR" ]; then
  echo "Error: Directory $DOCS_DIR not found"
  exit 1
fi

# Rename each file individually
rename_file "00_README.md" "00_README.md"
rename_file "01_project_overview.md" "01_project_overview.md"
rename_file "02_implementation_plan.md" "02_implementation_plan.md"
rename_file "03A_data_processing_workflow.md" "03_data_processing_workflow.md"
rename_file "03B_normalized_data_strategy.md" "04_normalized_data_strategy.md"
rename_file "03C_2025_survey_questions_and_responses.md" "05_survey_questions_and_responses.md"
rename_file "04_system_architecture.md" "06_system_architecture.md"
rename_file "05_ria25_prompt_evolution.md" "07_prompt_evolution.md"
rename_file "06_vector_store_reference.md" "08_vector_store_reference.md"
rename_file "07_development_timeline.md" "09_development_timeline.md"
rename_file "08_testing_methodology.md" "10_testing_methodology.md"
rename_file "09_vercel-deployment-guide.md" "11_vercel_deployment_guide.md"
rename_file "10_maintenance_procedures.md" "12_maintenance_procedures.md"
rename_file "11_canonical_topic_reference.md" "13_canonical_topic_reference.md"
rename_file "12_api_reference.md" "14_api_reference.md"
rename_file "13_thread_data_management.md" "15_thread_data_management.md"
rename_file "14_glossary.md" "16_glossary.md"

echo "File renaming complete. See $LOG_FILE for details."
echo ""
echo "IMPORTANT: This script has created copies of the files with new names."
echo "The original files have been preserved. If you're using Git, you may want to:"
echo "1. Review the changes"
echo "2. Delete the original files once you're satisfied"
echo "3. Commit the changes with git add and git commit"
echo ""
echo "Next steps:"
echo "1. Run update_references.sh to update cross-references in the documentation"
echo "2. Update documentation_map.md to reflect the new file names"
echo "3. Update generate_documentation.sh to use the new file pattern" 