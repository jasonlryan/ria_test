/**
 * Load the canonical topic mapping
 */
function loadCanonicalMapping() {
  try {
    console.log(
      `Attempting to load canonical mapping from: ${canonicalMappingPath}`
    );

    // Check if file exists
    if (!fs.existsSync(canonicalMappingPath)) {
      console.warn(
        `Canonical mapping file not found at: ${canonicalMappingPath}`
      );
      console.warn("Will use basic inferred topic mapping instead");

      // Create a basic mapping structure for the most common topics
      return createBasicMapping();
    }

    const canonicalData = JSON.parse(
      fs.readFileSync(canonicalMappingPath, "utf8")
    );

    // Create a flattened map for easier lookup
    const topicMap = new Map();

    // Handle different canonical mapping structure formats
    if (canonicalData.themes && Array.isArray(canonicalData.themes)) {
      // Standard format with themes
      canonicalData.themes.forEach((theme) => {
        theme.topics.forEach((topic) => {
          topicMap.set(topic.id, {
            id: topic.id,
            theme: theme.name,
            canonicalQuestion: topic.canonicalQuestion,
            mapping: topic.mapping || {},
            alternatePhrasings: topic.alternatePhrasings || [],
            comparable: topic.comparable || false,
          });
        });
      });
    } else if (canonicalData.topics && Array.isArray(canonicalData.topics)) {
      // Alternative format with just topics
      canonicalData.topics.forEach((topic) => {
        topicMap.set(topic.id, {
          id: topic.id,
          theme: topic.theme || "General",
          canonicalQuestion: topic.canonicalQuestion,
          mapping: topic.mapping || {},
          alternatePhrasings: topic.alternatePhrasings || [],
          comparable: topic.comparable || false,
        });
      });
    } else {
      console.warn(
        "Canonical mapping has unexpected format, using basic mapping"
      );
      return createBasicMapping();
    }

    console.log(`Loaded ${topicMap.size} topics from canonical mapping`);
    return topicMap;
  } catch (error) {
    console.error("Error loading canonical mapping:", error);
    // Return basic map as fallback
    console.warn("Using basic inferred topic mapping as fallback");
    return createBasicMapping();
  }
}

/**
 * Create a basic topic mapping when a canonical mapping isn't available
 */
function createBasicMapping() {
  const topicMap = new Map();

  // Add basic topics based on question patterns
  topicMap.set("Attraction_Factors", {
    id: "Attraction_Factors",
    theme: "Talent Attraction & Retention",
    canonicalQuestion:
      "What are the most important factors when looking for a new job?",
    mapping: { 2024: ["1", "Q1"] },
    alternatePhrasings: [
      "job attraction",
      "new job factors",
      "job search factors",
    ],
    comparable: false,
  });

  topicMap.set("Retention_Factors", {
    id: "Retention_Factors",
    theme: "Talent Attraction & Retention",
    canonicalQuestion:
      "What factors would make you stay at your current company?",
    mapping: { 2024: ["2", "Q2"] },
    alternatePhrasings: ["job retention", "stay factors", "retention drivers"],
    comparable: false,
  });

  topicMap.set("Intention_to_Leave", {
    id: "Intention_to_Leave",
    theme: "Talent Attraction & Retention",
    canonicalQuestion:
      "What factors would make you leave your current company?",
    mapping: { 2024: ["3", "Q3"] },
    alternatePhrasings: [
      "leave factors",
      "attrition drivers",
      "turnover factors",
    ],
    comparable: false,
  });

  topicMap.set("Work_Experience", {
    id: "Work_Experience",
    theme: "Employee Experience",
    canonicalQuestion: "How would you describe your current work experience?",
    mapping: { 2024: ["4", "Q4"] },
    alternatePhrasings: ["current role", "job satisfaction", "work conditions"],
    comparable: true,
  });

  topicMap.set("Wellbeing", {
    id: "Wellbeing",
    theme: "Employee Experience",
    canonicalQuestion: "How would you describe your wellbeing at work?",
    mapping: { 2024: ["5", "Q5"] },
    alternatePhrasings: [
      "work wellbeing",
      "employee wellness",
      "workplace health",
    ],
    comparable: true,
  });

  topicMap.set("Diversity_and_Inclusion", {
    id: "Diversity_and_Inclusion",
    theme: "Culture & Values",
    canonicalQuestion:
      "How would you describe diversity and inclusion at your workplace?",
    mapping: { 2024: ["6", "Q6"] },
    alternatePhrasings: [
      "diversity",
      "inclusion",
      "DE&I",
      "workplace diversity",
    ],
    comparable: true,
  });

  topicMap.set("Leadership_Confidence", {
    id: "Leadership_Confidence",
    theme: "Leadership & Management",
    canonicalQuestion:
      "How confident are you in your organization's leadership?",
    mapping: { 2024: ["7", "Q7"] },
    alternatePhrasings: [
      "leadership quality",
      "management confidence",
      "leader effectiveness",
    ],
    comparable: true,
  });

  topicMap.set("AI_Attitudes", {
    id: "AI_Attitudes",
    theme: "Future of Work",
    canonicalQuestion: "What are your attitudes toward AI in the workplace?",
    mapping: { 2024: ["4_9", "4_10", "4_11"] },
    alternatePhrasings: [
      "AI perception",
      "artificial intelligence",
      "AI adoption",
    ],
    comparable: false,
  });

  console.log(`Created basic mapping with ${topicMap.size} inferred topics`);
  return topicMap;
}
