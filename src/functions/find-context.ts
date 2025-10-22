
import { Pinecone } from "@pinecone-database/pinecone";
import { Resource } from "sst";
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

let pinecone: Pinecone | null = null;
let genAI: GoogleGenerativeAI | null = null;

const getPineconeClient = () => {
  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: Resource.PineconeApiKey.value,
    });
  }
  return pinecone;
};

const getGoogleAIClient = () => {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(Resource.GeminiApiKey.value);
  }
  return genAI;
}

export async function findContext(queryText: string): Promise<{ text: string; source: string } | null> {
  const pinecone = getPineconeClient();
  const index = pinecone.index("founding-documents");

  const genAI = getGoogleAIClient();
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  // Generate embedding for the query text
  const resultEmbedding = await model.embedContent(
    {
      content: { parts: [{ text: queryText }], role: "user" },
      taskType: TaskType.RETRIEVAL_QUERY,
    },
  );
  const queryVector = resultEmbedding.embedding.values;

  const result = await index.query({
    topK: 1,
    vector: queryVector,
    includeMetadata: true,
  });

  if (result.matches.length > 0) {
    const bestMatch = result.matches[0];
    const metadata = bestMatch.metadata as { raw_text: string; source: string };
    return {
      text: metadata.raw_text,
      source: metadata.source,
    };
  }

  return null;
}
