import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import { Resource } from "sst";
import { Buffer } from 'buffer';
import { findContext } from "./find-context";
import { TOP_LEVEL_TOPICS } from "../constants";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

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

    // Initialize Google Generative AI for content generation
    const geminiApiKey = Resource.GeminiApiKey.value;
    if (!geminiApiKey) {
      throw new Error("Gemini API Key is not available.");
    }
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const articleHeadline = selectedArticle.title;
    const articleContent = selectedArticle.content || selectedArticle.description || "";

    // Find the most relevant historical context using Pinecone
    console.log("Finding relevant historical context from Pinecone...");
    const bestMatch = await findContext(articleContent);

    if (!bestMatch) {
      throw new Error("Could not find any relevant historical context from Pinecone.");
    }

    console.log(`Found best match from: ${bestMatch.source}`);

    // Format the historical context for the prompt
    const historical_context = `- From ${bestMatch.source}: "${bestMatch.text.trim()}"`;

    // Step 2: Construct the new, integrated prompt

// TODO: automate keeping this current
    const currentDate = new Date().toDateString();
    const current_facts = `
### CURRENT FACTS ###
**Today's Date:** ${currentDate}
- **US President:** Donald J. Trump
- **US Vice President:** JD Vance
- **US Speaker of the House:** Mike Johnson
- **US Senate Majority Leader:** John Thune
- **US Chief Justice of the Supreme Court:** John G. Roberts, Jr.

**Select World Leaders:**
- **Canada:** Prime Minister Justin Trudeau
- **United Kingdom:** Prime Minister Rishi Sunak
- **France:** President Emmanuel Macron
- **Germany:** Federal Chancellor Olaf Scholz
- **Russia:** President Vladimir Putin
- **China:** President Xi Jinping
- **India:** Prime Minister Narendra Modi
- **Japan:** Prime Minister Fumio Kishida
- **Brazil:** President Luiz Inácio Lula da Silva
- **Ukraine:** President Volodymyr Zelenskyy
`;
    const prompt = `### PERSONA & STYLE GUIDE ###
You are an expert political correspondent and historian for 'Fauxios', a prestigious satirical news publication. Your writing style is modern, sharp, and intellectual, with an authoritative and engaging tone. Your satire must always punch up, targeting institutions and power. The humor is deadpan, subtle, and intellectual, arising from the stark, unblinking comparison between modern events and historical precedents. Avoid puns and overt jokes. Your unique characteristic is that you analyze ALL current political events through the specific lens of the grievances that led to the American Revolution. Your headlines and hooks should be particularly eye-catching and intriguing, designed to draw the reader in while maintaining journalistic integrity.

### TASK ###
Your task is to write a compelling and engaging satirical news article. Use the provided historical context to frame your satirical analysis of the modern event. The goal is to make the reader see the event not as a routine political squabble, but as a direct echo of a foundational threat to liberty, presented in a compelling and engaging manner.

${current_facts}

### INPUTS ###
**Modern News Event:**
Headline: "${articleHeadline}"
Content: "${articleContent}"

**Relevant Historical Context:**
${historical_context}

### OUTPUT FORMAT ###
Write the article strictly following these sections. Adhere to the specified character ranges for each section. Do NOT include any extra formatting characters (like asterisks, bolding, or italics) within the content of each section, only plain text.
Headline: (plain text)
<Your satirical headline that connects the modern event to a historical theme>
Hook: (150-200 characters, plain text)
<A standard, journalistic opening sentence.> 
Details: (500-700 characters, use bullet points for clarity, but ensure bullet points are simple hyphens and not bolded or italicized, plain text)
- <A factual-sounding detail from the modern event.>
- <An absurd detail that links the modern event to the historical context, presented factually.>
- <Another detail that reinforces the satirical premise.>
Why it Matters: (400-600 characters, 2 paragraphs separated by \n\n, plain text. If appropriate, include a direct quote from the Relevant Historical Context.)
<A concluding paragraph that explains the real-world implications, framed with historical gravity.>
<A second paragraph that further elaborates on the long-term significance or potential consequences.>
Topic: (plain text)
<Choose the single most relevant topic from this list: ${TOP_LEVEL_TOPICS.join(', ')}.>
Hashtags: (plain words, comma-separated, no '#' prefix)
<hashtag1, hashtag2, hashtag3>
`;

    const geminiResult = await model.generateContent(prompt);
    const fullGeneratedContent = geminiResult.response.text();
    console.log("Full Generated Content:\n", fullGeneratedContent);
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
    const articleHashtags = Array.from(new Set(hashtagsString.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(tag => tag.length > 0)));

    console.log("Extracted Title:", articleTitle);
    console.log("Extracted Hook:", articleHook);
    console.log("Extracted Details:", articleDetails);
    console.log("Extracted Why it Matters:", articleWhyItMatters);
    console.log("Extracted Topic:", articleTopic);
    console.log("Extracted Hashtags:", articleHashtags);

    const articleId = `article-${Date.now()}`;

    // Step 3: Replace your old imagePrompt with this one
    let imagePrompt = `A satirical political cartoon in the style of the American Revolutionary era, related to a satirical article with the headline: "${parsedSections["Headline"]}". The image should be absurdly humorous in a subtle way, without text or logos, suitable for a publication that mixes historical analysis with modern news.`;

    if (articleHeadline.toLowerCase().includes('trump') || articleContent.toLowerCase().includes('trump')) {
      imagePrompt += ` It should depicting the president as a caricature of King George III from the American Revolutionary era. He should have a comical yellow wig, be wearing a royal red coat, and be adorned with an excessive amount of gold, all in a humorous, exaggerated style. But otherwise, he should resemble the current president. 
      
      ${current_facts}`
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