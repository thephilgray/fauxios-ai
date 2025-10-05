import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import { Resource } from "sst";
import { Buffer } from 'buffer';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

// Define the new concepts
const concepts = ["Real Problem", "Grand Unified Theory", "Historical Narrator"];

export async function handler() {
  console.log("FauxiosGenerator handler started.");
  try {
    // Randomly select a concept
    const selectedConcept = concepts[Math.floor(Math.random() * concepts.length)];
    console.log("Selected Concept:", selectedConcept);

    // Fetch headlines from Newsdata.io
    console.log("Fetching headlines from Newsdata.io...");
    const newsdataApiKey = Resource.NewsdataApiKey.value;
    if (!newsdataApiKey) {
      throw new Error("NewsdataApiKey is not available.");
    }
    const newsdataUrl = `https://newsdata.io/api/1/news?apikey=${newsdataApiKey}&language=en&country=us&prioritydomain=top&qInMeta=politics&domain=axios`;
    const response = await fetch(newsdataUrl);
    interface NewsdataResponse {
      results: any[];
    }
    const data = await response.json() as NewsdataResponse;
    if (!data.results || data.results.length === 0) {
      throw new Error("No articles found from Newsdata.io.");
    }
    const allArticles: any[] = data.results;
    const allHeadlines: string[] = allArticles.map((article: any) => article.title);

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

    // We need up to 3 articles in total
    const selectedArticles = shuffledArticles.slice(0, 3);
    console.log("Selected Articles:", selectedArticles.map(a => a.title));

    // Fetch a random author for the selected concept
    const authorsTableName = Resource.Authors.name;
    const { Items: authors } = await ddbDocClient.send(new QueryCommand({
      TableName: authorsTableName,
      IndexName: "concept-index",
      KeyConditionExpression: "concept = :c",
      ExpressionAttributeValues: { ":c": selectedConcept },
    }));

    if (!authors || authors.length === 0) {
      throw new Error(`No authors found for concept: ${selectedConcept}`);
    }
    const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
    console.log("Selected Author:", randomAuthor.name, "Style:", randomAuthor.style);

    // Fetch existing topics
    const articlesTableNameForTopics = Resource.Articles.name;
    const scanTopicsCommand = new ScanCommand({
      TableName: articlesTableNameForTopics,
      ProjectionExpression: "topic",
    });
    const { Items: articlesForTopics } = await ddbDocClient.send(scanTopicsCommand);
    const existingTopics: string[] = articlesForTopics ? [...new Set(articlesForTopics.map((article: any) => article.topic).filter(Boolean))] : ["News", "Politics", "Business", "Technology"];
    const topicsList = existingTopics.join(', ');

    let prompt = "";
    let imagePrompt = "";
    let articleHeadline = "";
    let articleTopic = "News";

    // Base prompt instructions for all concepts
    const baseInstructions = `You are a satirical news writer for a website called 'Fauxios' that mimics the style of a major news publication. Your writing style should be: "${randomAuthor.style}". The satire must "punch up," targeting institutions, people in power, or corporations, never marginalized groups. Brevity and Efficiency: The headline and first paragraph must get the joke across immediately. Articles should be short and to the point. Use Specific Details: The humor must come from a single, absurd detail or from the specific juxtaposition of a modern event with a historical term. Use Quotes and Loaded Language: Use quotes to make headlines feel authentic and incorporate charged language (e.g., "monstrous," "unprecedented") in a calm, journalistic tone. Maintain a Consistent Style: Every element of the piece must serve the central joke. Focus on creating a humorous and entertaining narrative. The goal is to make the reader laugh, not to provide a sophisticated but meaningless political commentary. The humor should be deadpan. Strongly avoid puns. IMPORTANT: Always replace any mention of the current or former US President (e.g., Trump, Biden) with "the Cat Emperor". His inner circle and supporters should be referred to as "the cat cabal". The Cat Emperor is a mischievous and sadistic cat. The cat cabal are his sycophantic followers. Frame all their actions and motivations in the context of feline behavior (e.g., knocking things off shelves, demanding food, sleeping in sunbeams, etc.).`;

    switch (selectedConcept) {
      case "Real Problem":
        if (selectedArticles.length < 1) {
          throw new Error("Not enough articles for Real Problem concept.");
        }
        const article = selectedArticles[0];
        articleHeadline = article.title;
        const articleContent = article.content || article.description || "";

        // Fetch a random real problem
        const realProblemsTableName = Resource.RealProblems.name;
        const { Items: realProblems } = await ddbDocClient.send(new ScanCommand({ TableName: realProblemsTableName }));
        if (!realProblems || realProblems.length === 0) {
          throw new Error("No real problems found in RealProblems table.");
        }
        const randomProblem = realProblems[Math.floor(Math.random() * realProblems.length)];
        console.log("Random Real Problem:", randomProblem.description);

        // Fetch related statistics
        const problemStatsTableName = Resource.ProblemStats.name;
        const { Items: problemStats } = await ddbDocClient.send(new QueryCommand({
          TableName: problemStatsTableName,
          KeyConditionExpression: "problemName = :pn",
          ExpressionAttributeValues: { ":pn": randomProblem.problemId },
        }));
        let randomStat = null;
        if (problemStats && problemStats.length > 0) {
          randomStat = problemStats[Math.floor(Math.random() * problemStats.length)];
          console.log("Random Problem Stat:", randomStat.description);
        }

        prompt = `${baseInstructions}` +
          `
Your task is to write a satirical article that attributes the entire debate around the headline to a seemingly unrelated but real human problem.` +
          `
Source Article Content: ${articleContent}` +
          `
Input Headline: ${articleHeadline}\nReal Problem: ${randomProblem.description}\n${randomStat ? `Relevant Statistic: ${randomStat.description} (${randomStat.value})` : ''}` +
          `
Write the article following these sections:
Headline:
<Your satirical headline>
Hook:
<A standard, journalistic opening sentence.>
Details:
- <A factual-sounding detail.>
- <The absurd detail linking to the real problem, presented as a legitimate fact.>
- <Another factual-sounding detail.>
Why it Matters:
<A concluding paragraph that explains the real-world implications.>
Topic:
<Choose the most relevant topic from this list: ${topicsList}. If none are suitable, you can use a general topic like "World News" or "Culture".>
Hashtags:
<hashtag1, hashtag2, hashtag3>`;
        imagePrompt = `A satirical news image related to the headline: "${articleHeadline}" and the human problem: "${randomProblem.description}". The image should be absurd and humorous, without text or logos.`;
        break;

      case "Grand Unified Theory":
        if (selectedArticles.length < 2) {
          throw new Error("Not enough articles for Grand Unified Theory concept.");
        }
        const article1 = selectedArticles[0];
        const article2 = selectedArticles[1];
        articleHeadline = `${article1.title} and ${article2.title}`;
        const article1Content = article1.content || article1.description || "";
        const article2Content = article2.content || article2.description || "";

        prompt = `${baseInstructions}` +
          `
Your task is to take two unrelated news headlines and create a satirical theory that absurdly links them together as a single causal event.` +
          `
Source Article 1 Content: ${article1Content}` +
          `
Source Article 2 Content: ${article2Content}` +
          `
Headline 1: ${article1.title}\nHeadline 2: ${article2.title}` +
          `
Write the article following these sections:
Headline:
<Your satirical headline>
Hook:
<A standard, journalistic opening sentence.>
Details:
- <A factual-sounding detail related to Headline 1.>
- <A factual-sounding detail related to Headline 2.>
- <The absurd theory linking them, presented as a legitimate fact.>
Why it Matters:
<A concluding paragraph that explains the real-world implications.>
Topic:
<Choose the most relevant topic from this list: ${topicsList}. If none are suitable, you can use a general topic like "World News" or "Culture".>
Hashtags:
<hashtag1, hashtag2, hashtag3>`;
        imagePrompt = `A satirical news image absurdly linking two unrelated headlines: "${article1.title}" and "${article2.title}". The image should be humorous, without text or logos.`;
        break;

      case "Historical Narrator":
        if (selectedArticles.length < 3) {
          throw new Error("Not enough articles for Historical Narrator concept.");
        }
        const articleA = selectedArticles[0];
        const articleB = selectedArticles[1];
        const articleC = selectedArticles[2];
        articleHeadline = `${articleA.title}, ${articleB.title}, and ${articleC.title}`;
        const articleAContent = articleA.content || articleA.description || "";
        const articleBContent = articleB.content || articleB.description || "";
        const articleCContent = articleC.content || articleC.description || "";

        const historicalThemesTableName = Resource.HistoricalThemes.name;
        const { Items: historicalThemes } = await ddbDocClient.send(new ScanCommand({ TableName: historicalThemesTableName }));
        if (!historicalThemes || historicalThemes.length === 0) {
          throw new Error("No historical themes found in HistoricalThemes table.");
        }
        const randomHistoricalTheme = historicalThemes[Math.floor(Math.random() * historicalThemes.length)];
        console.log("Random Historical Theme:", randomHistoricalTheme.description);

        prompt = `${baseInstructions}` +
          `
Your task is to take three current news headlines and write a single article that explains them as the modern-day echo of a specific historical period or theme.` +
          `
Source Article 1 Content: ${articleAContent}` +
          `
Source Article 2 Content: ${articleBContent}` +
          `
Source Article 3 Content: ${articleCContent}` +
          `
Headline 1: ${articleA.title}\nHeadline 2: ${articleB.title}\nHeadline 3: ${articleC.title}\nHistorical Theme: ${randomHistoricalTheme.description}` +
          `
Write the article following these sections:
Headline:
<Your satirical headline>
Hook:
<A standard, journalistic opening sentence.>
Details:
- <A factual-sounding detail related to Headline 1.>
- <A factual-sounding detail related to Headline 2.>
- <A factual-sounding detail related to Headline 3.>
- <The absurd historical echo, presented as a legitimate fact.>
Why it Matters:
<A concluding paragraph that explains the real-world implications.>
Topic:
<Choose the most relevant topic from this list: ${topicsList}. If none are suitable, you can use a general topic like "World News" or "Culture".>
Hashtags:
<hashtag1, hashtag2, hashtag3>`;
        imagePrompt = `A satirical news image depicting the modern-day echo of the historical theme: "${randomHistoricalTheme.description}" in relation to current events. The image should be humorous, without text or logos.`;
        break;

      default:
        throw new Error("Invalid concept selected.");
    }

    const geminiApiKey = Resource.GeminiApiKey.value;
    if (!geminiApiKey) {
      throw new Error("Gemini API Key is not available.");
    }
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const geminiResult = await model.generateContent(prompt);
    const fullGeneratedContent = geminiResult.response.text();
    console.log("Full Generated Content:\n", fullGeneratedContent);

    // New parsing logic
    const sections = fullGeneratedContent.split(/\*\*\s*(Headline|Hook|Details|Why it Matters|Topic|Hashtags):\s*\*\*/).filter(Boolean);
    const parsedSections: { [key: string]: string } = {};
    for (let i = 0; i < sections.length; i += 2) {
      const sectionName = sections[i].trim();
      if (sections[i + 1]) {
        const sectionContent = sections[i + 1].trim();
        parsedSections[sectionName] = sectionContent;
      }
    }

    const articleTitle = parsedSections["Headline"];
    const articleHook = parsedSections["Hook"];
    const articleDetails = parsedSections["Details"];

    if (!articleTitle || !articleHook || !articleDetails) {
      throw new Error("Failed to generate all required article sections.");
    }

    const articleWhyItMatters = parsedSections["Why it Matters"] || "";
    articleTopic = parsedSections["Topic"] || "News";
    const hashtagsString = parsedSections["Hashtags"] || "";
    const articleHashtags = hashtagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    console.log("Extracted Title:", articleTitle);
    console.log("Extracted Hook:", articleHook);
    console.log("Extracted Details:", articleDetails);
    console.log("Extracted Why it Matters:", articleWhyItMatters);
    console.log("Extracted Topic:", articleTopic);
    console.log("Extracted Hashtags:", articleHashtags);

    const articleId = `article-${Date.now()}`;

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