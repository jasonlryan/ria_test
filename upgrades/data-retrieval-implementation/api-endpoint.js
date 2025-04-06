// API Endpoint for Data Retrieval
// This file implements the serverless function for retrieving complete data files

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { file_ids } = req.body;

  if (!file_ids || !Array.isArray(file_ids)) {
    return res.status(400).json({ error: "Invalid file_ids parameter" });
  }

  try {
    // GitHub implementation (simplest)
    const files = await Promise.all(
      file_ids.map(async (id) => {
        try {
          // Sanitize file ID to prevent any path traversal
          const safeId = id.replace(/[^a-zA-Z0-9_\.-]/g, "");

          // Get the correct path based on year in the file ID
          let year = "2025"; // Default to 2025
          if (safeId.startsWith("2024_")) {
            year = "2024";
          }

          const url = `https://raw.githubusercontent.com/RIA-analytics/survey-data/main/${year}/${safeId}`;

          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status}`);
          }

          const data = await response.json();
          return { id, data, error: null };
        } catch (err) {
          console.error(`Error fetching ${id}:`, err);
          return { id, data: null, error: err.message };
        }
      })
    );

    // Count total data points for validation
    let totalDataPoints = 0;
    for (const file of files) {
      if (file.data) {
        totalDataPoints += countDataPoints(file.data);
      }
    }

    return res.status(200).json({
      success: true,
      files,
      metadata: {
        requested: file_ids.length,
        succeeded: files.filter((f) => !f.error).length,
        failed: files.filter((f) => f.error).length,
        total_data_points: totalDataPoints,
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({ error: error.message });
  }
}

// Helper to count data points in file
function countDataPoints(data) {
  let count = 0;
  function traverse(obj) {
    if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        if (typeof obj[key] === "number") {
          count++;
        } else {
          traverse(obj[key]);
        }
      }
    }
  }
  traverse(data);
  return count;
}

// Alternative implementation using S3
export async function retrieveFromS3(file_ids) {
  // This would require AWS SDK to be installed
  // import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
  // const s3Client = new S3Client({
  //   region: process.env.AWS_REGION,
  //   credentials: {
  //     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  //     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  //   }
  // });
  // const files = await Promise.all(
  //   file_ids.map(async (id) => {
  //     try {
  //       const safeId = id.replace(/[^a-zA-Z0-9_\.-]/g, '');
  //       const year = safeId.startsWith("2024_") ? "2024" : "2025";
  //
  //       const command = new GetObjectCommand({
  //         Bucket: process.env.S3_BUCKET_NAME,
  //         Key: `${year}/${safeId}`
  //       });
  //
  //       const response = await s3Client.send(command);
  //       const stream = response.Body;
  //
  //       // Convert stream to string
  //       const chunks = [];
  //       for await (const chunk of stream) {
  //         chunks.push(chunk);
  //       }
  //       const buffer = Buffer.concat(chunks);
  //       const data = JSON.parse(buffer.toString());
  //
  //       return { id, data, error: null };
  //     } catch (err) {
  //       console.error(`Error fetching ${id} from S3:`, err);
  //       return { id, data: null, error: err.message };
  //     }
  //   })
  // );
  //
  // return files;
}

// Alternative implementation using Vercel KV (Key-Value Store)
export async function retrieveFromVercelKV(file_ids) {
  // This would require Vercel KV to be set up
  // import { kv } from '@vercel/kv';
  //
  // const files = await Promise.all(
  //   file_ids.map(async (id) => {
  //     try {
  //       const safeId = id.replace(/[^a-zA-Z0-9_\.-]/g, '');
  //       const data = await kv.get(safeId);
  //
  //       if (!data) {
  //         throw new Error(`File not found: ${safeId}`);
  //       }
  //
  //       return { id, data, error: null };
  //     } catch (err) {
  //       console.error(`Error fetching ${id} from Vercel KV:`, err);
  //       return { id, data: null, error: err.message };
  //     }
  //   })
  // );
  //
  // return files;
}
