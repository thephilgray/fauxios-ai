import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import fetch from "node-fetch";
import { Resource } from "sst";
import { Buffer } from 'buffer';
import * as fs from "fs";
import * as zlib from "zlib";
import { Readable } from "stream"; // Import Readable from 'stream'
import { TOP_LEVEL_TOPICS } from "../constants";

interface EmbeddingData {
  source: string;
  content: string;
  embedding: number[];
}

const EMBEDDINGS_BUCKET_NAME = Resource.Embeddings.name;
const EMBEDDINGS_FILE_KEY = "embeddings.json.gz"; // The key in the S3 bucket
const LOCAL_COMPRESSED_EMBEDDINGS_FILE_PATH = `/tmp/${EMBEDDINGS_FILE_KEY}`;
const LOCAL_DECOMPRESSED_EMBEDDINGS_FILE_PATH = `/tmp/embeddings.json`;

let ALL_EMBEDDINGS: EmbeddingData[] = [];

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});


async function downloadEmbeddingsFromS3() {
  console.log(`Downloading ${EMBEDDINGS_FILE_KEY} from S3 bucket ${EMBEDDINGS_BUCKET_NAME} to ${LOCAL_COMPRESSED_EMBEDDINGS_FILE_PATH}...`);
  try {
    const { Body } = await s3Client.send(new GetObjectCommand({
      Bucket: EMBEDDINGS_BUCKET_NAME,
      Key: EMBEDDINGS_FILE_KEY,
    }));

    if (Body) {
      const webStream = Body.transformToWebStream();
      const nodeStream = Readable.fromWeb(webStream as any); // Convert Web Stream to Node.js Stream
      const outputStream = fs.createWriteStream(LOCAL_COMPRESSED_EMBEDDINGS_FILE_PATH);
      await new Promise<void>((resolve, reject) => { // Explicitly type the Promise to resolve with void
        nodeStream.pipe(outputStream)
          .on('error', (err: Error) => reject(err)) // Wrap reject to pass the error
          .on('close', () => resolve());    // Wrap resolve to call it with no arguments
      });
      console.log("Compressed embeddings file downloaded successfully.");

      // Decompress the file
      console.log(`Decompressing ${LOCAL_COMPRESSED_EMBEDDINGS_FILE_PATH} to ${LOCAL_DECOMPRESSED_EMBEDDINGS_FILE_PATH}...`);
      const input = fs.createReadStream(LOCAL_COMPRESSED_EMBEDDINGS_FILE_PATH);
      const output = fs.createWriteStream(LOCAL_DECOMPRESSED_EMBEDDINGS_FILE_PATH);
      await new Promise<void>((resolve, reject) => { // Explicitly type the Promise to resolve with void
        input.pipe(zlib.createGunzip())
          .pipe(output)
          .on('error', (err: Error) => reject(err)) // Wrap reject to pass the error
          .on('close', () => resolve());    // Wrap resolve to call it with no arguments
      });
      console.log("Embeddings file decompressed successfully.");

    } else {
      throw new Error("S3 GetObjectCommand returned empty Body.");
    }
  } catch (error) {
    console.error("Error downloading or decompressing embeddings from S3:", error);
    throw error;
  }
}

// Initialize embeddings once during cold start
(async () => {
  try {
    await downloadEmbeddingsFromS3();
    ALL_EMBEDDINGS = JSON.parse(fs.readFileSync(LOCAL_DECOMPRESSED_EMBEDDINGS_FILE_PATH, "utf8"));
    console.log(`Loaded ${ALL_EMBEDDINGS.length} embeddings.`);
  } catch (error) {
    console.error("Failed to initialize ALL_EMBEDDINGS:\n", error); // Added newline for better readability
    // Depending on your error handling strategy, you might want to re-throw or handle gracefully
    throw error; // Re-throw to indicate a critical initialization failure
  }
})();

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function handler() {
  console.log("FauxiosGenerator handler started.");
  try {

    // Fetch headlines from Newsdata.io
    console.log("Fetching headlines from Newsdata.io...");
    const newsdataApiKey = Resource.NewsdataApiKey.value;
    if (!newsdataApiKey) {
      throw new Error("NewsdataApiKey is not available.");
    }
    const newsdataUrl = `https://newsdata.io/api/1/news?apikey=${newsdataApiKey}&language=en&country=us&prioritydomain=top&domain=axios`;
    const response = await fetch(newsdataUrl);
    interface NewsdataResponse {
      results: any[];
    }
    const data = await response.json() as NewsdataResponse;
    if (!data.results || data.results.length === 0) {
      throw new Error("No articles found from Newsdata.io.");
    }
    const allArticles: any[] = data.results;

    // Fetch all used headlines from Articles table
    const articlesTableNameForScan = Resource.Articles.name;
    const scanCommand = new ScanCommand({
      TableName: articlesTableNameForScan,
      ProjectionExpression: "headline",
    });
    const { Items: articles } = await ddbDocClient.send(scanCommand);
    const usedHeadlines: string[] = articles ? articles.map((article: any) => article.headline) : [];

    // Find unused articles
    const unusedArticles = allArticles.filter(article => !usedHeadlines.some(used => used.includes(article.title)));

    if (unusedArticles.length === 0) {
      throw new Error("No new articles found.");
    }

    // Shuffle the unused articles to get random ones
    const shuffledArticles = unusedArticles.sort(() => 0.5 - Math.random());

    // Select a single article for generation
    const selectedArticle = shuffledArticles[0];
    console.log("Selected Article:", selectedArticle.title);

    // Fetch a random author
    const authorsTableName = Resource.Authors.name;
    const { Items: authors } = await ddbDocClient.send(new ScanCommand({ TableName: authorsTableName }));

    if (!authors || authors.length === 0) {
      throw new Error("No authors found in Authors table.");
    }
    const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
    console.log("Selected Author:", randomAuthor.name);

    // Initialize Google Generative AI for embedding and content generation
    const geminiApiKey = Resource.GeminiApiKey.value;
    if (!geminiApiKey) {
      throw new Error("Gemini API Key is not available.");
    }
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });


    const articleHeadline = selectedArticle.title;
    const articleContent = selectedArticle.content || selectedArticle.description || "";

    // Generate embedding for the selected article's content
    const articleEmbeddingResult = await embeddingModel.embedContent({
      content: { parts: [{ text: articleContent }], role: "user" },
      taskType: TaskType.RETRIEVAL_QUERY,
    });
    const articleEmbedding = articleEmbeddingResult.embedding.values;

    // Perform vector search
    const similarities = ALL_EMBEDDINGS.map((historicalSnippet) => ({
      ...historicalSnippet,
      similarity: cosineSimilarity(articleEmbedding, historicalSnippet.embedding),
    }));

    // Sort by similarity and get top 5 relevant snippets
    const relevantSnippets = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    console.log("Top 5 Relevant Historical Snippets:");
    relevantSnippets.forEach((snippet) => {
      console.log(`- Source: ${snippet.source}, Similarity: ${snippet.similarity.toFixed(4)}`);
    });

    // Step 1: Format the historical context from your vector search results
    const historical_context = relevantSnippets
      .map(snippet => `- From ${snippet.source}: "${snippet.content.trim()}"`) // Corrected escaping for quotes within template literal
      .join('\n');

    // Step 2: Construct the new, integrated prompt
    const prompt = `### PERSONA & STYLE GUIDE ###
You are an expert political correspondent and historian for 'Fauxios', a prestigious satirical news publication. Your writing style is modern, formal, and professional, with the gravity of a constitutional scholar.

Your satire must always punch up, targeting institutions and power. The humor is deadpan, subtle, and intellectual, arising from the stark, unblinking comparison between modern events and historical precedents. Avoid puns and overt jokes. Your unique characteristic is that you analyze ALL current political events through the specific lens of the grievances that led to the American Revolution.

### TASK ###
Your task is to write a formal, analytical, yet satirical news article. Use the provided historical context to frame your satirical analysis of the modern event. The goal is to make the reader see the event not as a routine political squabble, but as a direct echo of a foundational threat to liberty.

### INPUTS ###
**Modern News Event:**
Headline: "${articleHeadline}"
Content: "${articleContent}"

**Relevant Historical Context:**
${historical_context}

### OUTPUT FORMAT ###
Write the article strictly following these sections:
Headline:
<Your satirical headline that connects the modern event to a historical theme>
Hook:
<A standard, journalistic opening sentence.>
Details:
- <A factual-sounding detail from the modern event.>
- <An absurd detail that links the modern event to the historical context, presented factually.>
- <Another detail that reinforces the satirical premise.>
Why it Matters:
<A concluding paragraph that explains the real-world implications, framed with historical gravity.>
Topic:
<Choose the single most relevant topic from this list: ${TOP_LEVEL_TOPICS.join(', ')}.>
Hashtags:
<hashtag1, hashtag2, hashtag3>
`;

    const geminiResult = await model.generateContent(prompt);
    const fullGeneratedContent = geminiResult.response.text();
    console.log("Full Generated Content:\n", fullGeneratedContent);

    // New parsing logic
    const sections = fullGeneratedContent.split(/(Headline|Hook|Details|Why it Matters|Topic|Hashtags)\s*:\s*\n*/);
    const parsedSections: { [key: string]: string } = {};

    // Start from index 1 because sections[0] will be an empty string before the first matched delimiter
    for (let i = 1; i < sections.length; i += 2) {
      const sectionName = sections[i].trim(); // This will be "Headline", "Hook", etc.
      const sectionContent = sections[i + 1] ? sections[i + 1].trim() : ""; // This will be the content
      parsedSections[sectionName] = sectionContent;
    }

    const articleTitle = parsedSections["Headline"];
    const articleHook = parsedSections["Hook"];
    let articleDetails = parsedSections["Details"];

    if (articleDetails) {
      articleDetails = articleDetails.split('\n').map(line => line.replace(/^-|\*\s*/, '').trim()).join('\n');
    }

    if (!articleTitle || !articleHook || !articleDetails) {
      throw new Error("Failed to generate all required article sections.");
    }

    const articleWhyItMatters = parsedSections["Why it Matters"] || "";
    const articleTopic = parsedSections["Topic"] || "World"; // Default to 'World' if AI doesn't provide one
    const hashtagsString = parsedSections["Hashtags"] || "";
    const articleHashtags = hashtagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    console.log("Extracted Title:", articleTitle);
    console.log("Extracted Hook:", articleHook);
    console.log("Extracted Details:", articleDetails);
    console.log("Extracted Why it Matters:", articleWhyItMatters);
    console.log("Extracted Topic:", articleTopic);
    console.log("Extracted Hashtags:", articleHashtags);

    const articleId = `article-${Date.now()}`;

    // Step 3: Replace your old imagePrompt with this one
    let imagePrompt = `A satirical, somewhat serious-looking news image related to a satirical article with the headline: "${parsedSections["Headline"]}". The image should be absurdly humorous in a subtle way, without text or logos, suitable for a publication that mixes historical analysis with modern news.`;

    if (articleHeadline.toLowerCase().includes('trump') || articleContent.toLowerCase().includes('trump')) {
      imagePrompt += ` The image should depict Donald Trump in the style of a political cartoon of King George III from the American Revolutionary era. He should have a yellow wig instead of a white one, be wearing a royal red coat (the same color as a MAGA hat), and be adorned with an excessive amount of gold.`
    }

    // 4. Generate an image for the article
    console.log("Generating image for the article...");
    const imageGenerationModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image-preview",
    });
    // TODO: Add retry logic for transient errors (e.g., 429 Too Many Requests, 503 Service Unavailable)
    const imageGenerationResult = await imageGenerationModel.generateContent(imagePrompt);

    let base64ImageData = '';
    let imageMimeType = 'image/png';

    try {
      if (imageGenerationResult.response.candidates && imageGenerationResult.response.candidates.length > 0) {
        const imagePart = imageGenerationResult.response.candidates[0].content.parts[1];
        if (imagePart && imagePart.inlineData) {
          base64ImageData = imagePart.inlineData.data;
          imageMimeType = imagePart.inlineData.mimeType;
        } else {
          console.error("Image data not found in expected inlineData format at parts[1].");
        }
      } else {
        console.error("No candidates found in imageGenerationResult.response.");
      }
    } catch (e) {
      console.error("Error parsing imageGenerationResult:", e);
    }

    const imageDataBuffer = Buffer.from(base64ImageData, 'base64');

    if (imageDataBuffer.length === 0) {
      throw new Error("Image generation failed, aborting article creation.");
    }

    const imageKey = `articles/${articleId}.png`;
    const imagesBucketName = Resource.Images.name;

    const putObjectCommand = new PutObjectCommand({
      Bucket: imagesBucketName,
      Key: imageKey,
      Body: imageDataBuffer,
      ContentType: imageMimeType,
    });
    await s3Client.send(putObjectCommand);

    const imageUrl = `https://${imagesBucketName}.s3.amazonaws.com/${imageKey}`;
    console.log("Generated Image URL:", imageUrl);

    // 5. Save the new article to the Articles DynamoDB table
    console.log("Saving the new article to the Articles table...");
    const articlesTableName = Resource.Articles.name;
    const putCommand = new PutCommand({
      TableName: articlesTableName,
      Item: {
        articleId: articleId,
        title: articleTitle,
        headline: articleHeadline,
        authorId: randomAuthor.authorId, // New field for author ID
        authorName: randomAuthor.name,   // New field for author name
        content: {
          hook: articleHook,
          details: articleDetails,
          whyItMatters: articleWhyItMatters,
        },
        imageUrl: imageUrl,
        createdAt: new Date().toISOString(),
        postedToSocial: "false",
        topic: articleTopic,
        hashtags: articleHashtags,
      },
    });
    await ddbDocClient.send(putCommand);
    console.log("Article saved successfully with ID:", articleId);

  } catch (error) {
    console.error("Error in FauxiosGenerator:", error);
    throw error;
  }
  console.log("FauxiosGenerator handler finished.");
}