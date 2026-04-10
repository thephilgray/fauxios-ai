import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import fetch from "node-fetch";
import { Resource } from "sst";
import type { Handler } from "aws-lambda";
import { Pinecone } from "@pinecone-database/pinecone";

interface ApifyPost {
  content: string;
  favourites_count?: number;
}

export const handler: Handler = async () => {
  console.log("--- GenerateTruthVsFoundingData handler invoked ---");
  
  try {
    const apifyApiKey = Resource.ApifyApiKey.value;
    const apifyUrl = `https://api.apify.com/v2/acts/muhammetakkurtt~truth-social-scraper/run-sync-get-dataset-items?token=${apifyApiKey}`;
    const payload = { userIds: ["realDonaldTrump"], maxItems: 15 };
    
    console.log("Fetching Truth Social posts via Apify...");
    const apifyRes = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      throw new Error(`Apify error: ${apifyRes.status} ${errText}`);
    }
    
    const data = await apifyRes.json() as ApifyPost[];
    if (!data || data.length === 0) {
      throw new Error("No posts found from Apify dataset.");
    }
    
    const sortedData = data.sort((a, b) => (b.favourites_count || 0) - (a.favourites_count || 0));
    // Pick randomly from the top 3 most popular recent posts to mix it up
    const topCandidates = sortedData.slice(0, Math.min(3, sortedData.length));
    const randomIdx = Math.floor(Math.random() * topCandidates.length);
    const mostPopularPost = topCandidates[randomIdx];

    const rawHtml = mostPopularPost.content || "";
    const truthText = rawHtml.replace(/<[^>]+>/g, '').trim();
    if (!truthText) {
        throw new Error("Truth text is empty after stripping HTML tags.");
    }
    console.log(`Extracted Truth: "${truthText.substring(0, 50)}..."`);

    // Fetch relevant quotes from Pinecone
    console.log("Querying Pinecone for context...");
    const pinecone = new Pinecone({ apiKey: Resource.PineconeApiKey.value });
    const index = pinecone.index("founding-documents");

    const genAI = new GoogleGenerativeAI(Resource.GeminiApiKey.value);
    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    const resultEmbedding = await embedModel.embedContent(
      {
        content: { parts: [{ text: truthText }], role: "user" },
        taskType: TaskType.RETRIEVAL_QUERY,
        outputDimensionality: 768,
      } as any,
    );
    const queryVector = resultEmbedding.embedding.values;

    const pineconeResult = await index.query({
      topK: 5,
      vector: queryVector,
      includeMetadata: true,
    });

    let contextText = "";
    if (pineconeResult.matches.length > 0) {
        pineconeResult.matches.forEach((match, ind) => {
            const metadata = match.metadata as { raw_text: string; source: string };
            contextText += `Quote ${ind + 1}:\n${metadata.raw_text}\nSource: ${metadata.source}\n\n`;
        });
    }

    console.log("Generating contrasting Revolution quote with Gemini...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a satirical expert. Here is a recent post from former US President Donald Trump on his "Truth Social" platform:
    
"${truthText}"

Here are 5 quotes retrieved from American founding documents that are conceptually related to the topic of his post:
${contextText}

From the 5 quotes above, isolate the single sentence or passage that most starkly REFUTES, CONTRADICTS, or exposes the hypocrisy of his statement. The quote must directly argue against the underlying spirit or message of his post to provide a sharp, critical juxtaposition.

Also, if the original Truth Social post is very long, extract the single most impactful, absurd, or relevant sentence/excerpt from it (if it's already short, just return the whole thing).

For the reference, properly format it to look highly professional. Use Title Case for the document name and provide the full name of the author (e.g. "John Adams, Thoughts on Government").

Return ONLY a valid JSON object in this exact structure with no markdown framing, tick marks or extra text:
{
  "truth_excerpt": "<the impactful excerpt from his post>",
  "quote": "<the isolated passage>",
  "reference": "<the cleanly formatted source document and author>"
}
`;

    const geminiResult = await model.generateContent(prompt);
    let generatedContent = geminiResult.response.text();
    generatedContent = generatedContent.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedJson;
    try {
        parsedJson = JSON.parse(generatedContent);
    } catch(e) {
        throw new Error("Failed to parse Gemini JSON output: " + generatedContent);
    }
    
    return {
        truthText: parsedJson.truth_excerpt,
        foundingQuoteText: parsedJson.quote,
        foundingReference: parsedJson.reference,
    };

  } catch (error) {
    console.error("Error in GenerateTruthVsFoundingData handler:", error);
    throw error;
  }
};
