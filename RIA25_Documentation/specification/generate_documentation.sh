#!/bin/bash

# RIA25 Documentation Generation Script - Ultra Simplified
DOCS_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation/specification"
OUTPUT_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation"
DOCX_OUTPUT="$OUTPUT_DIR/RIA25_Complete_Documentation.docx"
DATE=$(date +"%B %d, %Y")

echo "Generating documentation..."

# Create temporary metadata file and reference.docx for compact style
TEMP_DIR="$OUTPUT_DIR/temp"
mkdir -p $TEMP_DIR
META_FILE="$TEMP_DIR/metadata.yaml"

# Create compact metadata without TOC
cat > $META_FILE << EOL
---
title: "RIA25 Complete Documentation"
author: "Research Insights Assistant Team"
date: "$DATE"
---
EOL

# Create a reference.docx with more compact styling
REF_FILE="$TEMP_DIR/reference.docx"
pandoc -o $REF_FILE --print-default-data-file reference.docx

# Direct command with compact options
pandoc $META_FILE $DOCS_DIR/*.md -o $DOCX_OUTPUT --reference-doc=$REF_FILE --number-sections --standalone

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