import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import { Resource } from "sst";
import sharp from "sharp";
import type { Handler } from "aws-lambda";
import { randomUUID } from "crypto";

const s3Client = new S3Client({});

interface ApifyPost {
  content: string;
  favourites_count?: number;
}

export const handler: Handler = async () => {
  console.log("--- GenerateTruthVsVerse handler invoked ---");
  
  try {
    // 1. Fetch latest posts from Truth Social via Apify
    console.log("Fetching Truth Social posts via Apify...");
    const apifyApiKey = Resource.ApifyApiKey.value;
    if (!apifyApiKey) {
      throw new Error("ApifyApiKey is not available.");
    }
    
    const apifyUrl = `https://api.apify.com/v2/acts/muhammetakkurtt~truth-social-scraper/run-sync-get-dataset-items?token=${apifyApiKey}`;
    // Pull the last 15 posts to find the most popular recent one
    const payload = { userIds: ["realDonaldTrump"], maxItems: 15 };
    
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
    
    // Sort by popularity based on favorites count, descending
    const sortedData = data.sort((a, b) => (b.favourites_count || 0) - (a.favourites_count || 0));
    const mostPopularPost = sortedData[0];

    // Clean HTML tags from content
    const rawHtml = mostPopularPost.content || "";
    const truthText = rawHtml.replace(/<[^>]+>/g, '').trim();
    if (!truthText) {
        throw new Error("Truth text is empty after stripping HTML tags.");
    }
    console.log(`Extracted Truth: "${truthText.substring(0, 50)}..."`);

    // 2. Query Gemini for contrasting Bible verse
    console.log("Generating contrasting Bible verse with Gemini...");
    const geminiApiKey = Resource.GeminiApiKey.value;
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a satirical expert. Here is a recent post from former US President Donald Trump on his "Truth Social" platform:
    
"${truthText}"

Find a highly relevant or sharply contrasting Bible scripture that juxtaposes with his statement in a thought-provoking, ironic, or profound way.
Return ONLY a valid JSON object in this exact structure with no markdown framing, tick marks or extra text:
{
  "scripture": "<the text of the bible verse>",
  "reference": "<the book, chapter, and verse>"
}
`;

    const geminiResult = await model.generateContent(prompt);
    let generatedContent = geminiResult.response.text();
    // Clean response if it contains markdown ticks
    generatedContent = generatedContent.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedJson;
    try {
        parsedJson = JSON.parse(generatedContent);
    } catch(e) {
        throw new Error("Failed to parse Gemini JSON output: " + generatedContent);
    }
    
    console.log("Got scripture:", parsedJson.reference);

    // 3. Fetch Fonts
    console.log("Fetching font dependencies...");
    const mainFontResp = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.woff');
    const mainFontData = await mainFontResp.arrayBuffer();
    
    const serifFontResp = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/merriweather/files/merriweather-latin-400-normal.woff');
    const serifFontData = await serifFontResp.arrayBuffer();

    // 4. Generate side-by-side Layout using Satori
    console.log("Generating Satori layout...");
    const { default: satori } = await import('satori');
    const { Resvg } = await import('@resvg/resvg-js');

    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: '#f8f9fa',
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  width: '50%',
                  height: '100%',
                  padding: '50px',
                  borderRight: '2px solid #ddd',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: {
                        color: '#d32f2f',
                        fontSize: 28,
                        fontWeight: 'bold',
                        marginBottom: 30,
                        fontFamily: 'Inter',
                      },
                      children: "The 'Truth'",
                    }
                  },
                  {
                    type: 'div',
                    props: {
                      style: {
                        color: '#333',
                        fontSize: 22,
                        lineHeight: 1.5,
                        fontFamily: 'Inter',
                        display: 'flex',
                      },
                      children: truthText,
                    }
                  }
                ]
              }
            },
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  width: '50%',
                  height: '100%',
                  padding: '50px',
                  justifyContent: 'center',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: {
                        color: '#1976d2',
                        fontSize: 28,
                        fontWeight: 'bold',
                        marginBottom: 30,
                        fontFamily: 'Inter',
                      },
                      children: "The Verse",
                    }
                  },
                  {
                    type: 'div',
                    props: {
                      style: {
                        color: '#2c3e50',
                        fontSize: 26,
                        fontStyle: 'italic',
                        lineHeight: 1.6,
                        fontFamily: 'Merriweather',
                        marginBottom: 20,
                        display: 'flex',
                      },
                      children: `"${parsedJson.scripture}"`,
                    }
                  },
                  {
                    type: 'div',
                    props: {
                      style: {
                        color: '#2c3e50',
                        fontSize: 22,
                        fontWeight: 'bold',
                        fontFamily: 'Merriweather',
                        alignSelf: 'flex-end',
                      },
                      children: `— ${parsedJson.reference}`,
                    }
                  }
                ]
              }
            }
          ]
        }
      },
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Inter',
            data: mainFontData,
            weight: 400,
            style: 'normal',
          },
          {
            name: 'Merriweather',
            data: serifFontData,
            weight: 400,
            style: 'normal',
          }
        ],
      }
    );

    // 5. Convert SVG to PNG
    console.log("Rendering SVG to PNG...");
    const resvg = new Resvg(svg);
    const pngData = resvg.render();
    const imageBuffer = pngData.asPng();

    // 5. Upload to S3
    const processedImagesBucketName = Resource.ProcessedImages.name;
    const bucketKey = `truth-verses-${randomUUID()}.png`;
    
    console.log(`Uploading to S3: ${bucketKey}...`);
    const putObjectCommand = new PutObjectCommand({
        Bucket: processedImagesBucketName,
        Key: bucketKey,
        Body: imageBuffer,
        ContentType: "image/png",
    });
    await s3Client.send(putObjectCommand);

    const imageUrl = `https://${processedImagesBucketName}.s3.amazonaws.com/${bucketKey}`;

    // 6. Return data for Facebook Poster
    const caption = `Truth vs. The Word.\n\n#TruthSocial #Bible #Fauxios`;
    
    console.log("Successfully generated Truth vs Verses content.");
    return {
        imageUrl,
        caption
    };

  } catch (error) {
    console.error("Error in GenerateTruthVsVerse handler:", error);
    throw error;
  }
};
