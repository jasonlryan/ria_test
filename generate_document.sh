#!/bin/bash

# Set up variables
DOCS_DIR="/Users/jasonryan/Documents/RIA25/RIA25_Documentation"
OUTPUT_FILE="$DOCS_DIR/RIA25_Complete_Documentation.docx"
TEMP_DIR="$DOCS_DIR/temp_build"

# Cleanup and create temp directory
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR

# Copy README to temp dir with ordering prefix
cp "$DOCS_DIR/00_README.md" $TEMP_DIR/00_README.md

# Process each section folder and add page breaks
for i in {1..11}; do
  # Find files in each section matching the pattern
  section=$(printf "%d" $i)
  echo "Processing section $section"
  
  # Get all markdown files in the current section
  files=$(find "$DOCS_DIR" -name "${section}_*.md" -o -name "0${section}_*.md")
  
  for file in $files; do
    base=$(basename "$file")
    # Add page break marker at the beginning of each file except the first
    echo -e "\\newpage\n\n$(cat "$file")" > "$TEMP_DIR/$base"
    echo "  - Added $base"
  done
done

# Create a temporary YAML metadata file for styling
cat > $TEMP_DIR/metadata.yaml << 'YAML'
---
title: "RIA25 Complete Documentation"
author: "Research Insights Assistant Team"
date: "April 2024"
toc: true
toc-depth: 2
documentclass: report
geometry: margin=1in
fontsize: 12pt
header-includes:
  - \usepackage{fancyhdr}
  - \pagestyle{fancy}
  - \fancyhead[L]{RIA25 Documentation}
  - \fancyhead[R]{April 2024}
  - \fancyfoot[C]{\thepage}
---
YAML

echo "Building final document..."

# Use pandoc to convert all files to a Word document with proper ordering
pandoc \
  $TEMP_DIR/metadata.yaml \
  $TEMP_DIR/00_README.md \
  $(find $TEMP_DIR -name "01_*.md" | sort) \
  $(find $TEMP_DIR -name "02_*.md" | sort) \
  $(find $TEMP_DIR -name "03_*.md" | sort) \
  $(find $TEMP_DIR -name "04_*.md" | sort) \
  $(find $TEMP_DIR -name "05_*.md" | sort) \
  $(find $TEMP_DIR -name "06_*.md" | sort) \
  $(find $TEMP_DIR -name "07_*.md" | sort) \
  $(find $TEMP_DIR -name "08_*.md" | sort) \
  $(find $TEMP_DIR -name "09_*.md" | sort) \
  $(find $TEMP_DIR -name "10_*.md" | sort) \
  $(find $TEMP_DIR -name "11_*.md" | sort) \
  -o $OUTPUT_FILE \
  --toc \
  --toc-depth=2 \
  --reference-doc="$DOCS_DIR/RIA25_Complete_Documentation.docx"

echo "Document generated: $OUTPUT_FILE"
echo "Cleaning up..."
rm -rf $TEMP_DIR

# Copy this script to the documentation directory
SCRIPT_NAME=$(basename "$0")
SCRIPT_COPY="$DOCS_DIR/generate_documentation.sh"
cp "$0" "$SCRIPT_COPY"
chmod +x "$SCRIPT_COPY"
echo "Script copied to: $SCRIPT_COPY"

echo "Done." 