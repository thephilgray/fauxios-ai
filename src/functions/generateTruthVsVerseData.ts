import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import { Resource } from "sst";
import type { Handler } from "aws-lambda";

interface ApifyPost {
  content: string;
  favourites_count?: number;
}

export const handler: Handler = async () => {
  console.log("--- GenerateTruthVsVerseData handler invoked ---");
  
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
    const mostPopularPost = sortedData[0];

    const rawHtml = mostPopularPost.content || "";
    const truthText = rawHtml.replace(/<[^>]+>/g, '').trim();
    if (!truthText) {
        throw new Error("Truth text is empty after stripping HTML tags.");
    }
    console.log(`Extracted Truth: "${truthText.substring(0, 50)}..."`);

    console.log("Generating contrasting Bible verse with Gemini...");
    const geminiApiKey = Resource.GeminiApiKey.value;
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a satirical expert. Here is a recent post from former US President Donald Trump on his "Truth Social" platform:
    
"${truthText}"

Find a Bible scripture that starkly REFUTES, CONTRADICTS, or exposes the hypocrisy of his statement. The verse must directly argue against the underlying spirit or message of his quote to provide a sharp, critical juxtaposition.
Return ONLY a valid JSON object in this exact structure with no markdown framing, tick marks or extra text:
{
  "scripture": "<the text of the bible verse>",
  "reference": "<the book, chapter, and verse>"
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
        truthText,
        scriptureText: parsedJson.scripture,
        scriptureReference: parsedJson.reference,
    };

  } catch (error) {
    console.error("Error in GenerateTruthVsVerseData handler:", error);
    throw error;
  }
};
