# Data Retrieval System Setup Guide

This guide provides step-by-step instructions for setting up the RIA25 data retrieval system. The implementation allows for accurate analysis using complete data from survey files.

## Prerequisites

- Node.js (v16+)
- npm or yarn
- GitHub account
- Vercel account (for deployment)
- OpenAI API key

## Step 1: Set Up Data Repository

1. Create a new GitHub repository for hosting the survey data files:

```bash
mkdir -p survey-data
cd survey-data
mkdir -p 2024 2025
```

2. Copy your survey data files to the appropriate directories:

```bash
# For 2024 data files
cp path/to/2024/*.json 2024/

# For 2025 data files
cp path/to/2025/*.json 2025/
```

3. Initialize the repository and push to GitHub:

```bash
git init
git add .
git commit -m "Initial commit with survey data files"
git remote add origin https://github.com/your-username/survey-data.git
git push -u origin main
```

## Step 2: Create Vercel Project

1. Create a new Next.js project:

```bash
npx create-next-app@latest ria-data-api
cd ria-data-api
```

2. Install required dependencies:

```bash
npm install openai
```

3. Copy the implementation files from this repository:

```bash
# Create necessary directories
mkdir -p pages/api lib

# Copy API endpoint implementation
cp /path/to/data-retrieval-implementation/api-endpoint.js pages/api/retrieve-data.js

# Copy other implementation files
cp /path/to/data-retrieval-implementation/openai-integration.js lib/
cp /path/to/data-retrieval-implementation/validation.js lib/
```

4. Create main API endpoint for analysis:

```bash
# Create an API endpoint for analysis
touch pages/api/analyze.js
```

5. Edit the `pages/api/analyze.js` file:

```javascript
import { processQueryWithData } from "../../lib/openai-integration";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = req.body;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Invalid query parameter" });
  }

  try {
    const result = await processQueryWithData(query);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error processing query:", error);
    return res.status(500).json({ error: error.message });
  }
}
```

## Step 3: Update Configuration

1. Update the GitHub repository URL in `pages/api/retrieve-data.js`:

```javascript
// Find and replace the GitHub URL with your actual repository
const url = `https://raw.githubusercontent.com/your-username/survey-data/main/${year}/${safeId}`;
```

2. Create a `.env.local` file with your OpenAI API key:

```
OPENAI_API_KEY=your-openai-api-key
```

## Step 4: Add Validation Import

1. Open `lib/openai-integration.js` and add the import for the validation module:

```javascript
import { validateAnalysis } from "./validation";
```

## Step 5: Test Locally

1. Start the development server:

```bash
npm run dev
```

2. Test the API endpoints using a tool like Postman or curl:

```bash
# Test the retrieve-data endpoint
curl -X POST http://localhost:3000/api/retrieve-data \
  -H "Content-Type: application/json" \
  -d '{"file_ids": ["2025_ai_impact_global.json"]}'

# Test the analyze endpoint
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the global trends in AI adoption across industries?"}'
```

## Step 6: Deploy to Vercel

1. Push your code to GitHub:

```bash
git init
git add .
git commit -m "Initial implementation of data retrieval system"
git remote add origin https://github.com/your-username/ria-data-api.git
git push -u origin main
```

2. Connect your GitHub repository to Vercel:

   - Go to [Vercel](https://vercel.com/) and sign in
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables (add your OpenAI API key)
   - Click "Deploy"

3. Update the deployment URL in `lib/openai-integration.js`:

```javascript
const apiUrl =
  process.env.NODE_ENV === "production"
    ? "https://your-vercel-deployment.vercel.app/api/retrieve-data"
    : "http://localhost:3000/api/retrieve-data";
```

## Step 7: Create a Simple Frontend (Optional)

1. Create or edit `pages/index.js`:

```javascript
import { useState } from "react";
import styles from "../styles/Home.module.css";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Workforce Survey Insights</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about workforce survey data..."
            rows={4}
            className={styles.textarea}
          />
          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </form>

        {error && <div className={styles.error}>{error}</div>}

        {result && (
          <div className={styles.result}>
            <div
              className={styles.analysis}
              dangerouslySetInnerHTML={{
                __html: result.analysis.replace(
                  /\*\*(\d+%)\*\*/g,
                  "<strong>$1</strong>"
                ),
              }}
            />

            <div className={styles.metadata}>
              <p>Files used: {result.files_used.join(", ")}</p>
              <p>Data points available: {result.data_points}</p>
              {!result.validation.valid && (
                <div className={styles.warning}>
                  <h3>⚠️ Fabricated Data Detected</h3>
                  <p>
                    The following percentages do not appear in the data:{" "}
                    {result.validation.fabricatedPercentages.join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

2. Add some basic styling in `styles/Home.module.css`:

```css
.form {
  width: 100%;
  max-width: 800px;
  margin: 2rem 0;
  display: flex;
  flex-direction: column;
}

.textarea {
  padding: 1rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.button {
  padding: 0.5rem 1rem;
  background: #0070f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.button:disabled {
  background: #ccc;
}

.result {
  width: 100%;
  max-width: 800px;
  margin-top: 2rem;
}

.analysis {
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.metadata {
  font-size: 0.9rem;
  color: #666;
}

.warning {
  background: #fff3cd;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.error {
  color: #d32f2f;
  margin: 1rem 0;
}
```

## Step 8: Monitor and Maintain

1. Set up monitoring for your API endpoints
2. Review validation reports to ensure responses are using actual data
3. Update the data files as new survey data becomes available

## Troubleshooting

### API Rate Limiting

If you encounter rate limiting issues with OpenAI's API:

- Implement token-based rate limiting in your code
- Consider using a more advanced caching strategy

### Data Retrieval Issues

If files cannot be retrieved from GitHub:

- Check file permissions and repository visibility
- Try an alternative storage solution like S3 or Vercel KV

### Fabricated Data Detection

If the validation system reports fabricated data:

- Check that your data files contain diverse percentage values
- Ensure the system prompts emphasize using only actual data

## Conclusion

You now have a functioning data retrieval system that ensures AI-generated responses use complete data files instead of fabricating data or relying on sample points. This implementation addresses the core issues with the previous approach and provides a solid foundation for accurate data analysis.
