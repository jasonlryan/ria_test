# Implementation Plan Creation Prompt

**Last Updated:** Tue Apr 29 2025

<!--
LLM-GUIDANCE
This document serves as a self-prompt for creating the implementation plan for the repository pattern.
It defines the requirements for creating a comprehensive plan that properly cross-references
all analysis documents and includes thorough documentation standards.
-->

## Task Overview

Create a detailed implementation plan file in the repository analysis folder that properly cross-references all analysis documents, ensures reciprocal references across all documents, and specifies thorough header documentation for all interface files.

## File Location and Naming

- **Path**: `/Users/jasonryan/Documents/RIA25/utils/data/repository/analysis/IMPLEMENTATION_PLAN.md`
- **Adjacent to**: All analysis documents in the same folder

## Content Requirements

### 1. Timestamps and Documentation Standards

- **REQUIRED**: Run `date` command to get actual system timestamp
- Use exact timestamp in both header AND footer: `Tue Apr 29 2025`
- Format must follow pattern: "Day Month DD YYYY"
- Include timestamps in both locations:
  - Document header: `**Last Updated:** Tue Apr 29 2025`
  - Document footer: `_Last updated: Tue Apr 29 2025_`

### 2. Reciprocal Cross-References

- **CRITICAL**: Ensure ALL cross-references are bidirectional and consistent
- Create a complete reference map showing relationships between documents:
  - When IMPLEMENTATION_PLAN.md references a specific section in an analysis doc
  - The analysis doc must reference back to the corresponding section in IMPLEMENTATION_PLAN.md
- Use relative paths for all references: `./FileRepository-Analysis.md#section-anchor`
- Verify all section anchors exist and are correctly formatted
- Add missing section anchors to analysis docs if needed for proper referencing

### 3. LLM Implementation Guidance

```markdown
<!--
LLM-GUIDANCE
This document defines the implementation plan for the repository pattern.
When implementing:
1. Follow phases in order of dependencies
2. Reference specific sections of analysis documents when implementing
3. Create interfaces before implementations
4. Use proper documentation in all created files
5. Maintain backward compatibility through adapters
6. Do not implement until plan is approved
7. Ensure all interface files have comprehensive header documentation
8. Maintain reciprocal cross-references in all documentation
-->
```

### 4. Interface File Documentation Requirements

Specify that ALL interface files must include the following header documentation:

```typescript
/**
 * [Interface Name] Interface
 *
 * [One sentence description of purpose]
 * [One paragraph explanation of role in repository pattern]
 *
 * References:
 * - Implementation Plan: ../analysis/IMPLEMENTATION_PLAN.md#[specific-section-anchor]
 * - Analysis: ../analysis/[Specific]-Analysis.md#[specific-section-anchor]
 * - Related Interface: ./[Related]Interface.ts
 *
 * Last Updated: [EXACT SYSTEM DATE]
 */
```

### 5. Document Structure and Organization

- **Overview**: Explain repository pattern purpose and general approach
- **Dependency-Based Implementation Order**: List components in implementation order
- **Detailed Implementation Tasks**: Organize by phase with specific steps
- **Component Specifications**: For each interface and implementation file:
  - Exact file path
  - Purpose description
  - Component responsibilities
  - Dependencies on other components
  - Specific implementation steps
  - References to analysis sections
  - Documentation template

### 6. Required Sections

1. **Phase 1: Core Interface Implementation**

   - QueryContext interface implementation
   - FileRepository interface implementation
   - QueryProcessor interface implementation
   - SegmentManager interface implementation
   - CacheManager interface implementation

2. **Phase 2: Component Implementation**

   - FileSystemRepository implementation
   - QueryProcessorImpl implementation
   - Helper function implementation
   - Unit testing approach

3. **Phase 3: Adapter Implementation**

   - Retrieval.js adapter
   - DataRetrievalService.js adapter
   - Backward compatibility strategy

4. **Phase 4: Circular Dependency Resolution**

   - Extraction of core logic
   - Migration strategy
   - Testing approach

5. **Phase 5: Service Migration**
   - Gradual update strategy
   - Feature flag implementation
   - Final testing and verification

### 7. Analysis Document References

Include specific section references to these files:

- `./Consolidated-Analysis.md` - For overall strategy
- `./FileRepository-Analysis.md` - For file operation details
- `./QueryContext-Analysis.md` - For context structure details
- `./QueryProcessor-Analysis.md` - For query processing details
- `./README.md` - For overall document relationships

### 8. Implementation Checklist

Create a detailed checklist with:

- All implementation tasks organized by phase
- Status tracking for each task (Not Started, In Progress, Completed)
- Dependencies between tasks clearly marked
- Cross-references to specific analysis sections for each task

## Document Validation Criteria

1. **Reciprocal Cross-Reference Validation**

   - Every reference in IMPLEMENTATION_PLAN.md has a corresponding back-reference
   - All section anchors actually exist in target documents
   - References use correct relative paths for the file structure

2. **Header Documentation Validation**

   - Templates provided for each interface file
   - Documentation includes all required sections
   - References are specific (not general document references)

3. **Implementation Order Validation**

   - Order follows dependencies identified in Consolidated-Analysis.md
   - Critical path is clearly identified
   - No circular dependencies in implementation plan

4. **Completeness Validation**
   - All components from analysis documents are included
   - No interfaces or implementations are missing
   - All adapter patterns are specified

_Last updated: Tue Apr 29 2025_
