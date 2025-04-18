#!/bin/bash

# RIA25 Documentation Generation Script
# Updated: April 30, 2024
# Generates documentation in DOCX, PDF, and HTML formats

# Set up variables
DOCS_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation/specification"
OUTPUT_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation"
VERSION="2.0"
DATE=$(date +"%B %d, %Y")
TEMP_DIR="$OUTPUT_DIR/temp_build"

# Create output names
DOCX_OUTPUT="$OUTPUT_DIR/RIA25_Complete_Documentation.docx"
PDF_OUTPUT="$OUTPUT_DIR/RIA25_Complete_Documentation.pdf"
HTML_OUTPUT="$OUTPUT_DIR/RIA25_Complete_Documentation.html"

# Parse command line arguments
GENERATE_DOCX=true
GENERATE_PDF=false
GENERATE_HTML=false

# Process arguments
for arg in "$@"
do
    case $arg in
        --pdf)
        GENERATE_PDF=true
        shift
        ;;
        --html)
        GENERATE_HTML=true
        shift
        ;;
        --all)
        GENERATE_PDF=true
        GENERATE_HTML=true
        shift
        ;;
        --help)
        echo "RIA25 Documentation Generator"
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --pdf    Generate PDF output"
        echo "  --html   Generate HTML output"
        echo "  --all    Generate all formats (DOCX, PDF, HTML)"
        echo "  --help   Show this help message"
        exit 0
        ;;
    esac
done

# Cleanup and create temp directory
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR

# Copy README to temp dir
cp "$DOCS_DIR/00_README.md" $TEMP_DIR/00_README.md

echo "Preparing files for documentation generation..."

# Create file arrays for organized processing
declare -a FILES=(
  "$DOCS_DIR/00_README.md"
  "$DOCS_DIR/01_project_overview.md"
  "$DOCS_DIR/02_implementation_plan.md"
  "$DOCS_DIR/03_data_processing_workflow.md"
  "$DOCS_DIR/04_normalized_data_strategy.md"
  "$DOCS_DIR/05_survey_questions_and_responses.md"
  "$DOCS_DIR/06_system_architecture.md"
  "$DOCS_DIR/07_prompt_evolution.md"
  "$DOCS_DIR/08_vector_store_reference.md"
  "$DOCS_DIR/09_development_timeline.md"
  "$DOCS_DIR/10_testing_methodology.md"
  "$DOCS_DIR/11_vercel_deployment_guide.md"
  "$DOCS_DIR/12_maintenance_procedures.md"
  "$DOCS_DIR/13_canonical_topic_reference.md"
  "$DOCS_DIR/14_api_reference.md"
  "$DOCS_DIR/15_thread_data_management.md"
  "$DOCS_DIR/16_glossary.md"
  "$DOCS_DIR/17_file_function_reference.md"
)

# Process each file and add page breaks
for ((i=0; i<${#FILES[@]}; i++)); do
  file="${FILES[$i]}"
  if [ -f "$file" ]; then
    base=$(basename "$file")
    # Add page break marker at the beginning of each file except the first
    if [ $i -eq 0 ]; then
      cat "$file" > "$TEMP_DIR/$base"
    else
      echo -e "\\newpage\n\n$(cat "$file")" > "$TEMP_DIR/$base"
    fi
    echo "  - Added $base"
  else
    echo "  ! Warning: File not found: $file"
  fi
done

# Create a temporary YAML metadata file for styling
cat > $TEMP_DIR/metadata.yaml << YAML
---
title: "RIA25 Complete Documentation"
subtitle: "Research Insights Assistant 2025"
author: "Research Insights Assistant Team"
date: "$DATE"
version: "$VERSION"
toc: true
toc-depth: 2
documentclass: report
geometry: margin=1in
fontsize: 12pt
header-includes:
  - \usepackage{fancyhdr}
  - \pagestyle{fancy}
  - \fancyhead[L]{RIA25 Documentation}
  - \fancyhead[R]{Version $VERSION}
  - \fancyfoot[C]{\thepage}
---
YAML

echo "Building documents..."

# Build the input file list for pandoc
INPUT_FILES="$TEMP_DIR/metadata.yaml"

for file in "${FILES[@]}"; do
  base=$(basename "$file")
  if [ -f "$TEMP_DIR/$base" ]; then
    INPUT_FILES="$INPUT_FILES $TEMP_DIR/$base"
  fi
done

# Generate DOCX format
if [ "$GENERATE_DOCX" = true ]; then
  echo "Generating DOCX format..."
  pandoc $INPUT_FILES \
    -o $DOCX_OUTPUT \
    --toc \
    --toc-depth=2
  
  if [ $? -eq 0 ]; then
    echo "DOCX document generated: $DOCX_OUTPUT"
  else
    echo "Error generating DOCX document"
  fi
fi

# Generate PDF format if requested
if [ "$GENERATE_PDF" = true ]; then
  echo "Generating PDF format..."
  pandoc $INPUT_FILES \
    -o $PDF_OUTPUT \
    --toc \
    --toc-depth=2 \
    --pdf-engine=xelatex
  
  if [ $? -eq 0 ]; then
    echo "PDF document generated: $PDF_OUTPUT"
  else
    echo "Error generating PDF document"
  fi
fi

# Generate HTML format if requested
if [ "$GENERATE_HTML" = true ]; then
  echo "Generating HTML format..."
  pandoc $INPUT_FILES \
    -o $HTML_OUTPUT \
    --toc \
    --toc-depth=2 \
    --self-contained \
    --css=$DOCS_DIR/github-markdown.css
  
  if [ $? -eq 0 ]; then
    echo "HTML document generated: $HTML_OUTPUT"
  else
    echo "Error generating HTML document"
  fi
fi

echo "Cleaning up..."
rm -rf $TEMP_DIR

# Update version in README if needed
if [ -f "$DOCS_DIR/00_README.md" ]; then
  # Update the version and date in the README
  sed -i '' "s/Current documentation version: [0-9]\.[0-9]/Current documentation version: $VERSION/" "$DOCS_DIR/00_README.md"
  sed -i '' "s/Last updated: [A-Za-z]* [0-9]*, [0-9]*/Last updated: $DATE/" "$DOCS_DIR/00_README.md"
fi

echo "Documentation generation complete." 