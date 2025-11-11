import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';
import type { Handler } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

interface ArticleForSocials {
  articleId: string;
  title: string;
  content: {
    hook: string;
    details: string;
    whyItMatters: string;
  };
  hook: string;
  tweet: string;
  hashtags: string[];
  imageUrl: string;
  imageVariations: {
    [key: string]: string;
  };
}

interface PostToSocialsEvent {
  articleToPost: ArticleForSocials;
}

export const handler: Handler<PostToSocialsEvent> = async (event) => {
  console.log("--- PostToSocials handler invoked ---");
  console.log("Received payload:", JSON.stringify(event, null, 2));

  const { articleToPost } = event;

  try {
    const articleHook = articleToPost.hook;

    // 1. Post to Twitter/X
    const client = new TwitterApi({
      appKey: Resource.TwitterApiKey.value,
      appSecret: Resource.TwitterApiSecret.value,
      accessToken: Resource.TwitterAccessToken.value,
      accessSecret: Resource.TwitterAccessTokenSecret.value,
    });

    const hashtagsString = articleToPost.hashtags?.length > 0 ? `\n\n${articleToPost.hashtags.map((tag: string) => `#${tag}`).join(' ')}` : '';
    const tweetText = `${articleToPost.tweet}${hashtagsString}`;
    
    let mediaId = undefined;
    if (articleToPost.imageVariations && articleToPost.imageVariations['social']) {
      try {
        const imageUrlToDownload = articleToPost.imageVariations['social'];
        const url = new URL(imageUrlToDownload);
        const imageKey = url.pathname.substring(1); // Remove leading slash
        const processedImagesBucketName = Resource.ProcessedImages.name;

        const getObjectCommand = new GetObjectCommand({
          Bucket: processedImagesBucketName,
          Key: imageKey,
        });
        const response = await s3Client.send(getObjectCommand);
        if (!response.Body) {
          console.error("No body found for the S3 object.");
          return; // Return from the function if no body
        }
        const imageBuffer = await response.Body.transformToByteArray();

        // Upload image to Twitter
        mediaId = await client.v1.uploadMedia(Buffer.from(imageBuffer), { mimeType: 'image/png' });
        console.log("Image uploaded to Twitter with mediaId:", mediaId);
      } catch (imageError) {
        console.error("Error uploading image to Twitter:", imageError);
      }
    }

    try {
      await client.v2.tweet(tweetText, mediaId ? { media: { media_ids: [mediaId] } } : {});
      console.log(`Article "${articleToPost.title}" posted to Twitter.`);
    } catch (twitterError) {
      console.error("Error posting to Twitter:", JSON.stringify(twitterError, null, 2));
    }

    // Helper function to get Facebook Page Access Token
    async function getFacebookPageAccessToken(userId: string, userAccessToken: string, pageId: string): Promise<string | undefined> {
      try {
        const response = await axios.get(`https://graph.facebook.com/${userId}/accounts?access_token=${userAccessToken}`);
        const pages = response.data.data;
        const targetPage = pages.find((page: any) => page.id === pageId);
        if (targetPage) {
          console.log("Successfully fetched Facebook Page Access Token.");
          return targetPage.access_token;
        } else {
          console.error(`Facebook Page with ID ${pageId} not found among managed pages.`);
          return undefined;
        }
      } catch (error) {
        console.error("Error fetching Facebook Page Access Token:", error);
        return undefined;
      }
    }

    // 2. Post to Facebook
    const facebookUserId = Resource.FacebookUserId.value;
    const facebookUserAccessToken = Resource.FacebookUserAccessToken.value;
    const facebookPageId = Resource.FacebookPageId.value;

    if (facebookUserId && facebookUserAccessToken && facebookPageId) {
      const facebookPageAccessToken = await getFacebookPageAccessToken(facebookUserId, facebookUserAccessToken, facebookPageId);

      if (facebookPageAccessToken) {
        try {
          const facebookPostMessage = `📰 ${articleToPost.title}\n\n${articleToPost.hook}\n\n${articleToPost.content.details}\n\n${articleToPost.content.whyItMatters}${hashtagsString}`;
          const facebookPostData = {
            message: facebookPostMessage,
            url: articleToPost.imageUrl, // Use 'url' for image posts
            access_token: facebookPageAccessToken,
          };

          const facebookResponse = await axios.post(
            `https://graph.facebook.com/v19.0/${facebookPageId}/photos`,
            facebookPostData
          );
          console.log("Facebook post successful:", facebookResponse.data);
          console.log(`Article "${articleToPost.title}" posted to Facebook.`);
        } catch (facebookError) {
          console.error("Error posting to Facebook:", facebookError);
        }
      } else {
        console.log("Failed to obtain Facebook Page Access Token. Skipping Facebook post.");
      }
    } else {
        console.log("Missing Facebook credentials. Skipping Facebook post.");
    }

    // 3. Update the article's postedToSocial status in DynamoDB
    const updateCommand = new UpdateCommand({
      TableName: Resource.Articles.name,
      Key: { articleId: articleToPost.articleId },
      UpdateExpression: "SET postedToSocial = :postedToSocial",
      ExpressionAttributeValues: {
        ":postedToSocial": "true",
      },
    });
    await ddbDocClient.send(updateCommand);
    console.log(`Article "${articleToPost.title}" marked as posted.`);

    return { status: "SUCCESS" };

  } catch (error) {
    console.error("Error in PostToSocials handler:", error);
    throw error;
  }
};