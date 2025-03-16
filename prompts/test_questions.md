# Test Questions for Global Workforce Survey Analysis

These questions are designed to test if the system is correctly accessing the canonical mapping, applying the default 2025 behavior, and handling comparable vs. non-comparable topics properly.

## Basic Theme/Topic Questions

1. "What are the most important factors that attract candidates to new jobs in 2025?"
2. "Why do employees stay at their current companies?"
3. "What are the main reasons employees are leaving their organizations?"

## Comparable Topics (Should Show Both Years)

4. "Are employees planning to leave their current roles in the next three months? Has this changed since last year?"
5. "How fairly do employees feel they are paid for their work and skills? Has this changed since 2024?"
6. "What employment types do workers prefer in their ideal roles, and how has this changed since last year?"
7. "How well is the organization adapting to changes in the business environment compared to 2024?"

## Non-Comparable Topics (Should Show 2025 Only with Warning)

8. "How important is work-life flexibility to employees today?"
9. "What are employees' attitudes toward AI in the workplace?"
10. "How confident are employees in their organization's leadership?"

## Multi-Topic Questions

11. "What's the relationship between leadership confidence and intention to leave?"
12. "How do company culture and values affect employee wellbeing and motivation?"
13. "Compare the factors that attract candidates with the factors that make them stay."

## Demographic Detail Questions

14. "How do attitudes about AI differ across age groups and regions?"
15. "Is compensation satisfaction different across organization sizes?"
16. "Are younger employees more likely to want to leave their roles than older employees?"

## Specific Feature Tests

17. "How effective are managers in supporting their teams?" (2025-only topic)
18. "What workplace location arrangements do employees currently have versus what they would prefer?" (2025-only topic)
19. "How do different generations collaborate in the workplace?" (2025-only topic)

## Ambiguous Questions (Tests Topic Matching)

20. "Tell me about employee motivation levels."
21. "What do the survey results say about workplace flexibility?"
22. "How are employees feeling about AI replacing their jobs?"

## Expected Behaviors to Verify

- Always uses the canonical mapping file first
- Defaults to 2025 data
- Only offers comparisons for comparable topics
- Includes required userMessages for non-comparable topics
- Properly handles demographic breakdowns
- Lists factors in descending order of importance/percentage
- Finds the right topics even with ambiguous queries
- Formats responses according to presentation rules
