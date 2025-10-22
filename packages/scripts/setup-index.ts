
import { Pinecone } from "@pinecone-database/pinecone";
import { Resource } from "sst";

async function main() {
  console.log("Connecting to Pinecone...");
  const pinecone = new Pinecone({
    apiKey: Resource.PineconeApiKey.value,
  });

  const model = "llama-text-embed-v2";
  const indexName = "founding-documents";

  console.log(`Checking if index "${indexName}" already exists...`);
  const existingIndexes = await pinecone.listIndexes();
  if (existingIndexes.indexes?.some((index) => index.name === indexName)) {
    console.log(`Index "${indexName}" already exists. Exiting.`);
    return;
  }

  console.log(`Creating index "${indexName}" for model "${model}"...`);
  await pinecone.createIndex({
    name: indexName,
    dimension: 768, // From the text-embedding-004 model
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: "aws",
        region: "us-east-1",
      },
    },
    waitUntilReady: true,
  });

  console.log("Index created and ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
