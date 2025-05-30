# 2025 Global Workforce Survey: Questions and Response Options

**Last Updated:** Tue May 6 11:56:37 BST 2025

> **Target Audience:** Developers, Data Scientists, Content Specialists  
> **Related Documents:**
>
> - 04_normalized_data_strategy.md
> - 13_canonical_topic_reference.md
> - 03_data_processing_workflow.md

## Overview

This document lists all questions from the 2025 Global Workforce Survey along with their possible response options. In the v2 implementation, these questions and responses are structured through TypeScript interfaces and accessed via the repository pattern to ensure consistency and performance.

## TypeScript Interface Integration

In the repository pattern implementation, survey questions and responses are defined with TypeScript interfaces:

```typescript
// types/surveyQuestions.ts

export interface SurveyQuestion {
  id: string; // e.g., "Q1", "Q2", etc.
  text: string; // The full question text
  year: string; // Survey year ("2024" or "2025")
  responseType: ResponseType;
  options: ResponseOption[];
  mappedTopic?: string; // Reference to canonical topic (e.g., "Attraction_Factors")
  metadata: QuestionMetadata;
}

export type ResponseType =
  | "single_select"
  | "multi_select"
  | "likert_scale"
  | "matrix"
  | "open_text";

export interface ResponseOption {
  id: string;
  text: string;
  order: number;
}

export interface QuestionMetadata {
  sectionName?: string;
  isMandatory: boolean;
  displayCondition?: string;
  comparable: boolean;
  notes?: string;
}
```

## Repository Pattern Access

Survey questions and responses are accessed through the repository pattern:

```typescript
// repositories/surveyQuestionRepository.ts

import { SurveyQuestion } from "../types/surveyQuestions";
import kvClient from "../lib/kvClient";
import logger from "../utils/logger";
import fileSystem from "../utils/fileSystem";

export interface ISurveyQuestionRepository {
  getQuestionById(id: string, year: string): Promise<SurveyQuestion | null>;
  getQuestionsByTopic(topicId: string, year: string): Promise<SurveyQuestion[]>;
  getQuestionsByYear(year: string): Promise<SurveyQuestion[]>;
  searchQuestions(query: string): Promise<SurveyQuestion[]>;
}

export class SurveyQuestionRepository implements ISurveyQuestionRepository {
  private readonly cacheTTL = 60 * 60 * 24 * 7; // 7 days

  async getQuestionById(
    id: string,
    year: string
  ): Promise<SurveyQuestion | null> {
    const cacheKey = `survey:question:${year}:${id}`;

    try {
      // Try KV cache first
      const cached = await kvClient.get<SurveyQuestion>(cacheKey);
      if (cached) {
        return cached;
      }

      // Load from file system
      const questions = await this.loadQuestionsForYear(year);
      const question = questions.find((q) => q.id === id) || null;

      if (question) {
        // Cache for future use
        await kvClient.set(cacheKey, question, { ex: this.cacheTTL });
      }

      return question;
    } catch (error) {
      logger.error(
        `Error retrieving question ${id} for year ${year}: ${error.message}`
      );
      return null;
    }
  }

  async getQuestionsByTopic(
    topicId: string,
    year: string
  ): Promise<SurveyQuestion[]> {
    const cacheKey = `survey:questions:topic:${year}:${topicId}`;

    try {
      // Try KV cache first
      const cached = await kvClient.get<SurveyQuestion[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Load from file system
      const questions = await this.loadQuestionsForYear(year);
      const filtered = questions.filter((q) => q.mappedTopic === topicId);

      // Cache for future use
      await kvClient.set(cacheKey, filtered, { ex: this.cacheTTL });

      return filtered;
    } catch (error) {
      logger.error(
        `Error retrieving questions for topic ${topicId}, year ${year}: ${error.message}`
      );
      return [];
    }
  }

  async getQuestionsByYear(year: string): Promise<SurveyQuestion[]> {
    return this.loadQuestionsForYear(year);
  }

  async searchQuestions(query: string): Promise<SurveyQuestion[]> {
    try {
      // Load all questions from both years
      const questions2024 = await this.loadQuestionsForYear("2024");
      const questions2025 = await this.loadQuestionsForYear("2025");
      const allQuestions = [...questions2024, ...questions2025];

      // Perform simple search
      const lowerQuery = query.toLowerCase();
      return allQuestions.filter(
        (q) =>
          q.text.toLowerCase().includes(lowerQuery) ||
          q.options.some((o) => o.text.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      logger.error(
        `Error searching questions for "${query}": ${error.message}`
      );
      return [];
    }
  }

  private async loadQuestionsForYear(year: string): Promise<SurveyQuestion[]> {
    const cacheKey = `survey:questions:year:${year}`;

    try {
      // Try KV cache first
      const cached = await kvClient.get<SurveyQuestion[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Load from file system
      const filePath = `scripts/reference files/${year}/questions.json`;
      const questions = await fileSystem.readJsonFile<SurveyQuestion[]>(
        filePath
      );

      // Cache for future use
      await kvClient.set(cacheKey, questions, { ex: this.cacheTTL });

      return questions;
    } catch (error) {
      logger.error(
        `Error loading questions for year ${year}: ${error.message}`
      );
      return [];
    }
  }
}
```

## 2025 Global Workforce Survey Questions

The following sections list all questions from the 2025 Global Workforce Survey with their response options. In the v2 implementation, these are stored in JSON format and accessed through the repository pattern.

### Q1 - If you were to look for a new job, what would be the most important factors for you?

**Mapped Topic:** Attraction_Factors  
**Response Type:** multi_select  
**Response options:**

- Salary and compensation
- Flexible work hours
- Remote work options
- Workplace location/commute
- Career advancement opportunities
- Learning and development opportunities
- Job security
- Organizational culture and values
- Employee benefits (healthcare, wellness, etc.)
- Work-life balance
- Manager/leadership quality
- Colleagues and team dynamics
- Organizational reputation
- Meaningful/purposeful work
- Industry/field of work
- Social responsibility (e.g., societal justice, community outreach) policies and practices
- Environmental sustainability policies and practices
- Use of advanced technologies (e.g., AI, automation)
- Visa sponsorship / immigration assistance from an employer
- Other

### Q2 - When considering the below options which are would be most likely to make you stay at your current company?

**Mapped Topic:** Retention_Factors  
**Response Type:** multi_select  
**Response options:**

- Employee benefits (e.g., healthcare, mental health and wellness services, Paid Time Off, complimentary food and services)
- Manager I trust
- Flexible work hours
- Employer's respect for personal priorities outside of work
- Colleagues I work with
- Career advancement
- Commute to office
- Learning and development opportunities
- Reputation of the organization
- Workplace policy (i.e. in office, from home, hybrid)
- Organizational culture and values
- Organizational purpose and mission
- Social responsibility (e.g., societal justice, community outreach) policies and practices
- Inclusive policies and practices
- Environmental sustainability policies and practices
- Use of advanced technologies (e.g., AI, automation)
- Visa sponsorship / immigration assistance from an employer
- Other

### Q3 - When considering the below options, which are most likely to make you leave your current company?

**Mapped Topic:** Attrition_Factors  
**Response Type:** multi_select  
**Response options:**

- Inadequate employee benefits (e.g., healthcare, mental health and wellness services, Paid Time Off, complimentary food and services)
- Employer's respect for personal priorities outside of work
- Manager I don't trust
- Colleagues I work with
- Lack of flexible work hours
- Commute to office
- Poor organizational culture and values
- Inadequate learning and development opportunities
- Workplace policy (i.e. in office, from home, hybrid)
- Reputation of the organization
- Organization not fulfilling purpose and mission
- Poor social responsibility (e.g., societal justice, community outreach) policies and practices
- Non-inclusive policies and practices
- Poor environmental sustainability policies and practices
- Use of advanced technologies (e.g., AI, automation)
- Visa sponsorship / immigration assistance from an employer
- Other

### Q4 - Please confirm the location of your current place of work, and also where this would ideally be for you?

**Mapped Topic:** Current_and_Preferred  
**Response Type:** matrix  
**Current place of work (response options):**

- Full-time in office
- Full-time remote
- Hybrid work (blend of working from home and office)
- Unsure

**Ideal place of work (response options):**

- Full-time in office
- Full-time remote
- Hybrid work (blend of working from home and office)
- Unsure

### Q5 - To what extent do you agree with the following statements about AI in the workplace and skills.

**Mapped Topic:** AI_Attitudes, AI_Readiness  
**Response Type:** likert_scale  
**Statements to rate:**

- My organization offers a broad enough range of learning approaches [e.g. self-directed video/e-learning/podcasts/short modules/practical workshops] to suit my needs
- My organization encourages experimentation with new technologies
- I feel excited and positive about how emerging technologies like AI will change the way I work
- I think using AI in my role will bolster my value in the next three years
- When I've been asked to use AI to help with my job, I found it produced better results and/or improved efficiency
- I feel leaders in my organization understand AI
- I feel adequately trained to use AI tools
- I feel certain that my role will be replaced by AI/tech in the next three years

### Q6 - To what extent do you agree with the following statements with regards to your workplace.

**Mapped Topics:** Work_Life_Flexibility, Employee_Wellbeing, Intergenerational_Collaboration  
**Response Type:** likert_scale  
**Statements to rate:**

- I feel my company provides a variety of ways to communicate and connect with colleagues
- I feel leaders in my company respect the needs of employees across generations
- I feel my company provides adequate support for employee mental well-being
- I have strong connections with my remote colleagues
- I would stay at a job if it paid me the salary I want, even if I hated the role
- I would stay at a job if it allowed me flexibility, even if I hated the role
- My organization has taken steps to reduce cultural gaps between different generations of workers
- I feel I work better with people my own age

### Q7 - To what extent do you agree with the following statements.

**Mapped Topics:** DEI, Organizational_Adaptation  
**Response Type:** likert_scale  
**Statements to rate:**

- The organization handles decisions about people with sensitivity and care
- I am worried about how to make my resume/ CV stand out in the competitive job market
- My organization's leaders value people over profits
- I am concerned about a lack of jobs for my skillset
- I am open to relocating to another country to secure a job
- I am concerned that protectionism policies around immigration are affecting my ability to find work
- I expect a significant reduction in DEI initiatives at my company since new governments were elected
- I feel my company is using Return to Office policies and other rules to push me out

### Q8 - To what extent do you agree with the following statements.

**Mapped Topics:** Leadership_Confidence, Manager_Capability, Imposter_Syndrome  
**Response Type:** likert_scale  
**Statements to rate:**

- Leaders at my organization are often not aligned
- I feel recent changes in senior leadership has negatively impacted the operations at our firm
- I am stretched too far beyond my capabilities at work
- I feel that I am overlooked for leadership roles because of my age
- I frequently doubt my ability to fulfill my work responsibilities
- I feel that I am overlooked for training because of my age
- I feel that I am overlooked for promotions, pay rises, or leadership training because of my class
- I feel that I am overlooked for promotions, pay rises, or leadership training because of my sex
- I feel that I am overlooked for promotions, pay rises, or leadership training because of my race
- I struggle with imposter syndrome
- I share negative reviews about my employer on social media or review sites (such as Glassdoor)

### Q9 - To what extent do you agree with the following statements.

**Mapped Topics:** Culture_and_Values, Communication_and_Connection  
**Response Type:** likert_scale  
**Statements to rate:**

- My manager empowers me
- I feel that my ideas and opinions will be welcomed by company leaders
- If a problem in my personal life is affecting my work/performance, I feel comfortable telling my manager about it
- Our external reputation matches our internal culture
- I'm comfortable discussing my personal life with my colleagues
- My manager appears overwhelmed at work
- My organization has cut back on the number of managers
- The lack of managers at my organization leaves me feeling directionless

### Q10 - What would your ideal role be?

**Mapped Topic:** Ideal_Role  
**Response Type:** single_select  
**Response options:**

- Permanent Full Time
- Part time
- Contract / Interim Part Time
- Contract / Interim Full Time
- Freelance Part Time
- Freelance Full Time

### Q11 - How well do you think you are compensated for your skillset?

**Mapped Topic:** Pay_and_Reward  
**Response Type:** single_select  
**Response options:**

- My company gives me a salary and benefits that are below the value of my skills
- My company gives me a salary and benefits that match the value of my skills
- My company gives me a salary and benefits that exceed the value of my skills

### Q12 - Are you planning on leaving your current role in the next three months?

**Mapped Topic:** Intention_to_Leave  
**Response Type:** single_select  
**Response options:**

- No, not interested in moving
- I'm considering it and looking at options
- I'm currently applying and/or interviewing
- I'm preparing to retire

### Q13 - What would your ideal role be?

**Mapped Topic:** Ideal_Role  
**Response Type:** single_select  
**Response options:**

- Permanent Full Time
- Part time
- Contract / Interim Part Time
- Contract / Interim Full Time
- Freelance Part Time
- Freelance Full Time

### Q14 - What are the biggest challenges you face when working with colleagues from different generations?

**Mapped Topic:** Intergenerational_Collaboration  
**Response Type:** multi_select  
**Response options:**

- Different communication styles
- Gaps in technology skills
- Conflicting values or priorities
- Leadership bias towards specific age groups
- I don't experience any challenges

### Q15 - Which of the following would help you collaborate better with colleagues from different generations?

**Mapped Topic:** Intergenerational_Collaboration  
**Response Type:** multi_select  
**Response options:**

- Training on communication and teamwork
- A stronger focus on shared values and goals
- Technology training for bridging skill gaps
- Reverse mentorship programmes
- Training on how to work remotely with colleagues
- None of these

### Q16 - Do you feel your company allows you to switch off at the end of the day without an expectation to answer emails or calls?

**Mapped Topic:** Work_Life_Flexibility  
**Response Type:** single_select  
**Response options:**

- Yes, there is no expectation to answer emails or calls after I log off
- Somewhat, I still have to answer urgent emails or calls on a case-by-case basis
- Not at all, my company expects me to always be available and responsive

### Q17 - To what extent do you agree with the following statements.

**Mapped Topics:** Skills_Utilization, Motivation_and_Fulfillment, Learning_and_Development  
**Response Type:** likert_scale  
**Statements to rate:**

- My job makes good use of my skills and abilities
- My job provides opportunities to do challenging and interesting work
- I have good opportunities for learning and development at the company
- The organization motivates me to do my best work
- The organization is strategically adapting to changes in the business environment
- I feel motivated to do more than is required of me
- I have trust and confidence in the company's senior leadership team
- The organization shows care and concern for its employees

## Response Formats

For rating scales (Q5-Q9, Q17), responses use a five-point Likert scale:

1. Strongly Disagree
2. Disagree
3. Neither Agree nor Disagree
4. Agree
5. Strongly Agree

In the data storage, these responses are often normalized to:

- "Agree" (combining "Agree" and "Strongly Agree")
- "Neutral" (representing "Neither Agree nor Disagree")
- "Disagree" (combining "Disagree" and "Strongly Disagree")

## Canonical Topic Mapping

All questions are mapped to canonical topics as defined in the canonical topic mapping system. This mapping facilitates:

1. **Topic-Based Analysis**: Questions are grouped by theme rather than question number
2. **Cross-Year Comparison**: Questions measuring similar concepts across years are linked
3. **Query Processing**: User queries are mapped to canonical topics to retrieve relevant questions

## Data Access Patterns

In the repository pattern implementation, survey questions and responses are accessed through structured patterns:

```typescript
// Example usage in services

import { SurveyQuestionRepository } from "../repositories/surveyQuestionRepository";
import { CanonicalTopicRepository } from "../repositories/canonicalTopicRepository";

// Service example
export class SurveyAnalysisService {
  constructor(
    private questionRepository: SurveyQuestionRepository,
    private topicRepository: CanonicalTopicRepository
  ) {}

  async getQuestionsForTopic(topicId: string): Promise<{
    topic: string;
    questions2024: SurveyQuestion[];
    questions2025: SurveyQuestion[];
    comparable: boolean;
  }> {
    // Get topic details
    const topic = await this.topicRepository.getTopicById(topicId);

    if (!topic) {
      throw new Error(`Topic ${topicId} not found`);
    }

    // Get questions for both years
    const questions2024 = await this.questionRepository.getQuestionsByTopic(
      topicId,
      "2024"
    );
    const questions2025 = await this.questionRepository.getQuestionsByTopic(
      topicId,
      "2025"
    );

    return {
      topic: topic.canonicalQuestion,
      questions2024,
      questions2025,
      comparable: topic.comparable,
    };
  }
}
```

## Conclusion

The survey questions and responses form the foundation of the RIA25 data architecture. Through TypeScript interfaces, repository pattern implementation, and Vercel KV integration, the system provides:

1. **Type Safety**: Through comprehensive TypeScript interfaces
2. **Abstraction**: Via the repository pattern for consistent data access
3. **Performance**: With Vercel KV caching for frequently accessed questions
4. **Integration**: With the canonical topic mapping system for intuitive querying
5. **Maintainability**: Through structured access patterns and clear interfaces

---

_Last updated: Tue May 6 11:56:37 BST 2025_
