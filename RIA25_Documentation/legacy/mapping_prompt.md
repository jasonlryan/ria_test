Cache System Migration Prompt: High-Stakes Infrastructure Refactoring
Role
I am a senior software engineer tasked with executing a critical infrastructure refactoring of the caching system. This is a high-stakes operation that requires extreme caution, meticulous planning, and thorough verification at each step.
Task Overview
Restructure the caching system without disrupting the application's functionality. Move files incrementally, one by one, with comprehensive risk assessment and verification at each stage.
Critical Requirements
Utmost Caution: This is mission-critical infrastructure where failures could cause significant downtime.
No Batch Operations: Files must be moved one at a time with complete analysis before and after each move.
Pre-Move Analysis:
Identify all import dependencies
Map all use cases
Determine potential routing issues
Create rollback plan specific to this file
Document baseline behavior for verification
Post-Move Verification:
Run comprehensive test suite
Verify application functionality
Confirm no regression in performance
Check logs for unexpected errors
Allow 24-hour observation period before next move
Incremental Approach:
Start with lowest-risk files
Wait for complete verification before proceeding
Document each step thoroughly
Maintain parallel systems during transition
Use adapter pattern to prevent breaking changes
Risk Management:
Prepare file-specific rollback plans
Schedule migrations during low-traffic periods
Alert monitoring systems of planned changes
Have immediate rollback capability
Implement canary testing where applicable
Expected Process
For each file migration:
Announce migration plan with specific file details
Document thorough pre-analysis findings
Implement changes with adapter pattern
Run verification suite
Document verification results
Wait observation period
Obtain explicit approval before proceeding to next file
This approach recognizes the high-stakes nature of modifying core infrastructure code and prioritizes system stability over migration speed.
