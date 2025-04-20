#!/bin/bash

# RIA25 Documentation Generation Script - Ultra Simplified
DOCS_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation/specification"
OUTPUT_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation"
DOCX_OUTPUT="$OUTPUT_DIR/RIA25_Complete_Documentation.docx"
DATE=$(date +"%B %d, %Y")

echo "Generating documentation..."

# Create temporary metadata file
TEMP_DIR="$OUTPUT_DIR/temp"
mkdir -p $TEMP_DIR
META_FILE="$TEMP_DIR/metadata.yaml"

cat > $META_FILE << EOL
---
title: "RIA25 Complete Documentation"
author: "Research Insights Assistant Team"
date: "$DATE"
toc: true
---
EOL

# Direct command with all the right options
pandoc $META_FILE $DOCS_DIR/*.md -o $DOCX_OUTPUT --toc --number-sections --standalone

if [ $? -eq 0 ]; then
  echo "Documentation generated: $DOCX_OUTPUT"
else
  echo "Error generating documentation"
  exit 1
fi

# Clean up
rm -rf $TEMP_DIR

echo "Documentation generation complete." 