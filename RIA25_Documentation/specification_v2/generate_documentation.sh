#!/bin/bash

# RIA25 Documentation Generation Script - Ultra Simplified
DOCS_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation/specification_v2"
OUTPUT_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation"
DOCX_OUTPUT="$OUTPUT_DIR/RIA25_Complete_Documentation_v2.docx"
DATE=$(date +"%B %d, %Y")

echo "Generating documentation..."

# Create temporary metadata file and reference.docx for compact style
TEMP_DIR="$OUTPUT_DIR/temp_build"
mkdir -p $TEMP_DIR
META_FILE="$TEMP_DIR/metadata.yaml"

# Create compact metadata without TOC
cat > $META_FILE << EOL
---
title: "RIA25 Complete Documentation (v2)"
author: "Research Insights Assistant Team"
date: "$DATE"
---
EOL

# Create a reference.docx with more compact styling
REF_FILE="$TEMP_DIR/reference.docx"
pandoc -o $REF_FILE --print-default-data-file reference.docx

# Define file order with all specification_v2 files, including the new ones
FILES=(
  "$DOCS_DIR/00_README.md"
  "$DOCS_DIR/01_project_overview.md"
  "$DOCS_DIR/02_implementation_plan.md"
  "$DOCS_DIR/03_data_processing_workflow.md"
  "$DOCS_DIR/04_normalized_data_strategy.md"
  "$DOCS_DIR/05_survey_questions_and_responses.md"
  "$DOCS_DIR/06_system_architecture.md"
  "$DOCS_DIR/07_prompt_evolution.md"
  "$DOCS_DIR/08_vector_store_reference.md"
  "$DOCS_DIR/10_testing_methodology.md"
  "$DOCS_DIR/11_vercel_deployment_guide.md"
  "$DOCS_DIR/13_canonical_topic_reference.md"
  "$DOCS_DIR/14_api_reference.md"
  "$DOCS_DIR/15_thread_data_management.md"
  "$DOCS_DIR/16_glossary.md"
  "$DOCS_DIR/17_file_function_reference.md"
  "$DOCS_DIR/18_vercel_kv_cache_reference.md"
)

# Direct command with compact options and specified file order
pandoc $META_FILE ${FILES[@]} -o $DOCX_OUTPUT --reference-doc=$REF_FILE --number-sections --standalone

if [ $? -eq 0 ]; then
  echo "Documentation generated: $DOCX_OUTPUT"
  echo "Page count will be reduced without TOC and with compact styling."
else
  echo "Error generating documentation"
  exit 1
fi

# Clean up
rm -rf $TEMP_DIR

echo "Documentation generation complete." 