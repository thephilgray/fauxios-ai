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

const junkPatterns = [
  "_JUST PUBLISHED_",
  "[WARNING: This file was truncated. To view the full content, use the 'read_file' tool on this specific file.]"
];

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function cleanText(text: string): string {
  let cleanedText = text;
  for (const pattern of junkPatterns) {
    cleanedText = cleanedText.replace(new RegExp(escapeRegExp(pattern), 'g'), '');
  }

  // Normalize all newlines to \n
  cleanedText = cleanedText.replace(/\r\n/g, '\n');

  // Split text into paragraphs based on one or more empty lines
  const paragraphs = cleanedText.split(/\n\s*\n/);

  const cleanedParagraphs = paragraphs.map(p => {
    // Replace single newlines within a paragraph with a space, effectively joining wrapped lines.
    // Then normalize all whitespace to a single space and trim.
    return p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  });

  // Join the cleaned paragraphs back together with double newlines.
  return cleanedParagraphs.filter(p => p.length > 0).join('\n\n');
}

export function chunkText(text: string): string[] {
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
  const args = process.argv.slice(2);
  const specificFile = args[0];

  console.log(`Seeding index "${indexName}"...`);

  let filesToProcess: string[] = [];

  if (specificFile) {
    // If a specific file is provided, use it
    filesToProcess.push(specificFile);
    console.log(`Processing specific file: ${specificFile}`);
  } else {
    // Otherwise, read all files from the sources directory
    filesToProcess = await fs.readdir(sourcesDir);
    console.log(`Processing all files in ${sourcesDir}`);
  }

  for (const file of filesToProcess) {
    if (path.extname(file) !== ".txt") continue;

    console.log(`Processing source: ${file}...`);
    const sourceId = path.basename(file, ".txt");
    const sourceValue = sourceId.replace(/-/g, " ");

    // Delete all existing vectors for this source to prevent orphans
    console.log(`Deleting existing chunks for source: "${sourceValue}"...`);
    await index.deleteMany({
      source: { '$eq': sourceValue },
    });
    console.log(`Finished deleting existing chunks for "${sourceValue}".`);

    const filePath = path.join(sourcesDir, file);
    const rawContent = await fs.readFile(filePath, "utf-8");

    const cleanedContent = cleanText(rawContent);
    const chunks = chunkText(cleanedContent);

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