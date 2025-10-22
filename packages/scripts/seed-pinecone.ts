import { Pinecone } from "@pinecone-database/pinecone";
import { Resource } from "sst";
import * as fs from "fs/promises";
import * as path from "path";
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: Resource.PineconeApiKey.value,
});
const indexName = "founding-documents";
const index = pinecone.index(indexName);

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(Resource.GeminiApiKey.value);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

const sourcesDir = path.resolve(process.cwd(), "sources");

const MAX_CHUNK_SIZE = 4000; // Max characters per chunk

function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= MAX_CHUNK_SIZE) {
      chunks.push(paragraph);
    } else {
      // Paragraph is too long, split into sentences
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      let currentChunk = "";
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > MAX_CHUNK_SIZE) {
          chunks.push(currentChunk);
          currentChunk = "";
        }
        currentChunk += sentence + " ";
      }
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
    }
  }
  return chunks;
}

async function main() {
  console.log(`Seeding index "${indexName}"...`);

  const files = await fs.readdir(sourcesDir);

  for (const file of files) {
    if (path.extname(file) !== ".txt") continue;

    console.log(`Processing source: ${file}...`);
    const sourceId = path.basename(file, ".txt");
    const filePath = path.join(sourcesDir, file);
    const content = await fs.readFile(filePath, "utf-8");

    const chunks = chunkText(content);

    console.log(`Found ${chunks.length} chunks in ${file}.`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const id = `${sourceId}-chunk${i}`;

      // Generate embedding for the chunk
      const result = await model.embedContent(
        {
          content: { parts: [{ text: chunk }], role: "user" },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
        },
      );
      const embedding = result.embedding.values;

      await index.upsert([
        {
          id: id,
          values: embedding,
          metadata: {
            raw_text: chunk,
            source: sourceId.replace(/-/g, " "),
          },
        },
      ]);
    }
    console.log(`Finished processing ${file}.`);
  }

  console.log("Seeding complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
