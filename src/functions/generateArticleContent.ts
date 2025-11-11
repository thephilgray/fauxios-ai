import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import { Resource } from "sst";
import { findContext } from "./find-context";
import { TOP_LEVEL_TOPICS } from "../constants";
import type { Handler } from "aws-lambda";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler: Handler = async (event) => {
  console.log("--- GenerateArticleContent handler invoked ---");
  
  try {
    // 1. Fetch headlines from Newsdata.io
    console.log("Fetching headlines from Newsdata.io...");
    const newsdataApiKey = Resource.NewsdataApiKey.value;
    if (!newsdataApiKey) {
      throw new Error("NewsdataApiKey is not available.");
    }
    const newsdataUrl = `https://newsdata.io/api/1/news?apikey=${newsdataApiKey}&language=en&country=us&prioritydomain=top&domain=axios`;
    const response = await fetch(newsdataUrl);
    const data = await response.json() as { results: any[] };
    if (!data.results || data.results.length === 0) {
      throw new Error("No articles found from Newsdata.io.");
    }

    // 2. Find an unused article
    const articlesTableName = Resource.Articles.name;
    const scanCommand = new ScanCommand({
      TableName: articlesTableName,
      ProjectionExpression: "headline",
    });
    const { Items: usedArticles } = await ddbDocClient.send(scanCommand);
    const usedHeadlines = usedArticles ? usedArticles.map(a => a.headline) : [];
    const unusedArticle = data.results.find(article => !usedHeadlines.some(used => used.includes(article.title)));

    if (!unusedArticle) {
      throw new Error("No new articles found to generate content for.");
    }
    console.log("Selected Article:", unusedArticle.title);

    // 3. Find relevant historical context from Pinecone
    const articleContent = unusedArticle.content || unusedArticle.description || "";
    console.log("Finding relevant historical context from Pinecone...");
    const bestMatch = await findContext(articleContent);
    if (!bestMatch) {
      throw new Error("Could not find any relevant historical context from Pinecone.");
    }
    console.log(`Found best match from: ${bestMatch.source}`);
    const historical_context = `- From ${bestMatch.source}: \"${bestMatch.text.trim()}\"`;

    // 4. Generate the satirical article using Gemini
    console.log("Generating satirical article with Gemini...");
    const geminiApiKey = Resource.GeminiApiKey.value;
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
Headline: "${unusedArticle.title}"
Content: "${articleContent}"

**Relevant Historical Context:**
${historical_context}

### OUTPUT FORMAT ###
Write the article strictly following these sections. Adhere to the specified character ranges for each section. Do NOT include any extra formatting characters (like asterisks, bolding, or italics) within the content of each section, only plain text.
Headline: (plain text)
<Your satirical headline that connects the modern event to a historical theme>
Hook: (150-200 characters, plain text)
<A standard, journalistic opening sentence.> 
Tweet: (around 100 characters, plain text)
<A short, punchy tweet that summarizes the article's premise.>
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

    // 5. Parse the generated content
    console.log("Parsing generated content...");
    const sections = fullGeneratedContent.split(/(Headline|Hook|Tweet|Details|Why it Matters|Topic|Hashtags)\s*:\s*\n*/);
    const parsedSections: { [key: string]: string } = {};
    for (let i = 1; i < sections.length; i += 2) {
      parsedSections[sections[i].trim()] = sections[i + 1] ? sections[i + 1].trim() : "";
    }

    const articleTitle = parsedSections["Headline"];
    const articleHook = parsedSections["Hook"];
    const articleTweet = parsedSections["Tweet"];
    let articleDetails = parsedSections["Details"];
    if (articleDetails) {
      articleDetails = articleDetails.split('\n').map(line => line.replace(/^-|\*\s*/, '').trim()).join('\n');
    }

    if (!articleTitle || !articleHook || !articleDetails || !articleTweet) {
      throw new Error("Failed to generate all required article sections.");
    }

    // 6. Fetch a random author
    const { Items: authors } = await ddbDocClient.send(new ScanCommand({ TableName: Resource.Authors.name }));
    if (!authors || authors.length === 0) throw new Error("No authors found.");
    const randomAuthor = authors[Math.floor(Math.random() * authors.length)];

    // 7. Return the complete article data for the next step
    const articleData = {
      articleId: `article-${Date.now()}`,
      title: articleTitle,
      headline: unusedArticle.title, // Original headline
      authorId: randomAuthor.authorId,
      authorName: randomAuthor.name,
      hook: articleHook,
      tweet: articleTweet,
      content: {
        hook: articleHook,
        details: articleDetails,
        whyItMatters: parsedSections["Why it Matters"] || "",
      },
      topic: parsedSections["Topic"] || "World",
      hashtags: Array.from(new Set((parsedSections["Hashtags"] || "").split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean))),
      createdAt: new Date().toISOString(),
      postedToSocial: "false",
    };

    console.log("Successfully generated article content.");
    return articleData;

  } catch (error) {
    console.error("Error in GenerateArticleContent handler:", error);
    throw error;
  }
};