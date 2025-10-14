import * as fs from "fs";
import * as path from "path";
import { Resource } from "sst";
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"; // Import S3Client and PutObjectCommand
import * as zlib from "zlib"; // Import zlib

const SOURCES_DIR = path.join(process.cwd(), "sources");
const OUTPUT_DIR = path.join(process.cwd(), "assets");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "embeddings.json");
const COMPRESSED_OUTPUT_FILE = path.join(OUTPUT_DIR, "embeddings.json.gz"); // New: Compressed output file
const BATCH_SIZE = 100; // Process 100 chunks at a time

interface EmbeddingData {
  source: string;
  content: string;
  embedding: number[];
}

async function main() {
  console.log("Starting embedding generation script...");

  // 1. Initialize Google Generative AI
  const geminiApiKey = Resource.GeminiApiKey.value;
  if (!geminiApiKey) {
    throw new Error("Gemini API Key is not available. Please ensure it's configured in sst.config.ts.");
  }
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  // 2. Read source files and chunk content
  console.log(`Reading text files from: ${SOURCES_DIR}`);
  const allChunks: { source: string; content: string }[] = [];
  const files = fs.readdirSync(SOURCES_DIR);

  for (const file of files) {
    if (file.endsWith(".txt")) {
      const filePath = path.join(SOURCES_DIR, file);
      const content = fs.readFileSync(filePath, "utf8");
      // Split content into paragraphs, filtering out empty strings
      const chunks = content.split(/(?<=[.?!])\s+(?=[A-Z])/).filter((p) => p.trim().length > 0);

      for (const chunk of chunks) {
        allChunks.push({ source: file, content: chunk.trim() });
      }
      console.log(`- Processed "${file}": ${chunks.length} chunks`);
    }
  }

  if (allChunks.length === 0) {
    console.log("No text chunks found to embed. Exiting.");
    return;
  }

  console.log(`Total chunks to embed: ${allChunks.length}`);

  // 3. Process chunks in batches and generate embeddings
  const allEmbeddings: EmbeddingData[] = [];
  const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    console.log(`Processing batch ${batchNumber} of ${totalBatches}...`);

    const requests = batch.map((chunk) => ({
      content: { parts: [{ text: chunk.content }], role: "user" },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
    }));

    try {
      const result = await model.batchEmbedContents({ requests });
      const embeddings = result.embeddings;

      embeddings.forEach((embeddingResult, index) => {
        allEmbeddings.push({
          source: batch[index].source,
          content: batch[index].content,
          embedding: embeddingResult.values,
        });
      });
    } catch (error) {
      console.error(`Error embedding batch ${batchNumber}:`, error);
      // Depending on error, you might want to retry or skip this batch
      // For now, we'll just log and continue, which means these chunks will be missing embeddings
    }
  }

  // 4. Save the embeddings to a JSON file
  console.log(`Saving ${allEmbeddings.length} embeddings to: ${OUTPUT_FILE}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true }); // Ensure output directory exists
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allEmbeddings, null, 2), "utf8");

  // New: Compress and upload to S3
  console.log("Compressing embeddings file...");
  const embeddingsContent = fs.readFileSync(OUTPUT_FILE);
  const compressedEmbeddings = zlib.gzipSync(embeddingsContent);
  fs.writeFileSync(COMPRESSED_OUTPUT_FILE, compressedEmbeddings);
  console.log(`Compressed embeddings saved to: ${COMPRESSED_OUTPUT_FILE}`);

  console.log("Uploading compressed embeddings to S3...");
  const s3Client = new S3Client({});
  const embeddingsBucketName = Resource.Embeddings.name;
  const putObjectCommand = new PutObjectCommand({
    Bucket: embeddingsBucketName,
    Key: "embeddings.json.gz",
    Body: compressedEmbeddings,
    ContentType: "application/gzip",
  });
  await s3Client.send(putObjectCommand);
  console.log(`Compressed embeddings uploaded to s3://${embeddingsBucketName}/embeddings.json.gz`);


  console.log("Embedding generation script finished successfully!");
}

main().catch((error) => {
  console.error("Script failed with error:", error);
  process.exit(1);
});