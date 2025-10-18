import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { TwitterApi } from 'twitter-api-v2';
import axios from 'axios';

const ddbClient = new DynamoDBClient({});
const s3Client = new S3Client({});

export async function handler(event: { articleId?: string }) {
  console.log("SocialMediaPoster handler started.");

  // Only post to social media in the 'dev' stage (which is the production stage for this project)
  if (process.env.STAGE !== 'dev') {
    console.log(`Skipping social media post in stage: ${process.env.STAGE}`);
    return;
  }

  try {
    const articlesTableName = Resource.Articles.name;
    let articleToPost;

    if (event.articleId) {
      // If invoked with an articleId, fetch that specific article
      const queryCommand = new QueryCommand({
        TableName: articlesTableName,
        KeyConditionExpression: "articleId = :articleId",
        ExpressionAttributeValues: {
          ":articleId": { S: event.articleId! }, // Use non-null assertion
        },
      });
      const { Items } = await ddbClient.send(queryCommand);
      if (Items && Items.length > 0) {
        articleToPost = {
          articleId: Items[0].articleId?.S ?? '',
          title: Items[0].title?.S ?? '',
          imageUrl: Items[0].imageUrl?.S ?? '',
          imageVariations: Items[0].imageVariations?.S ? JSON.parse(Items[0].imageVariations.S) : {},
          hashtags: Items[0].hashtags?.L?.map(tag => tag.S ?? '') ?? [], // Add hashtags
        };
      }
    } else {
      // Fallback: if not invoked with articleId, scan for unposted articles (original logic)
      const queryCommand = new QueryCommand({
        TableName: articlesTableName,
        IndexName: "postedToSocial-index",
        KeyConditionExpression: "postedToSocial = :postedToSocial",
        ExpressionAttributeValues: {
          ":postedToSocial": { S: "false" },
        },
        ScanIndexForward: false,
        Limit: 1,
      });
      const { Items: newArticles } = await ddbClient.send(queryCommand);
      if (newArticles && newArticles.length > 0) {
        articleToPost = {
          articleId: newArticles[0].articleId?.S ?? '',
          title: newArticles[0].title?.S ?? '',
          imageUrl: newArticles[0].imageUrl?.S ?? '',
          imageVariations: newArticles[0].imageVariations?.S ? JSON.parse(newArticles[0].imageVariations.S) : {},
          hashtags: newArticles[0].hashtags?.L?.map(tag => tag.S ?? '') ?? [], // Add hashtags
        };
      }
    }

    if (!articleToPost) {
      console.log("No article found to post.");
      return;
    }

    console.log("Article to post:", articleToPost.title);

    // 2. Post the article to Twitter/X
    const client = new TwitterApi({
      appKey: Resource.TwitterApiKey.value,
      appSecret: Resource.TwitterApiSecret.value,
      accessToken: Resource.TwitterAccessToken.value,
      accessSecret: Resource.TwitterAccessTokenSecret.value,
    });

    const hashtagsString = articleToPost.hashtags && articleToPost.hashtags.length > 0 ?
      `\n\n${articleToPost.hashtags.map((tag: string) => `#${tag}`).join(' ')}` : '';
    const tweetText = `📰 ${articleToPost.title}\n\nRead more: https://www.fauxios.com/articles/${articleToPost.articleId}${hashtagsString}`;
    
    let mediaId = undefined;
    if (articleToPost.imageVariations && articleToPost.imageVariations['social-square']) {
      try {
        const imageUrlToDownload = articleToPost.imageVariations['social-square'];
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

    await client.v2.tweet(tweetText, mediaId ? { media: { media_ids: [mediaId] } } : {});

    console.log(`Article "${articleToPost.title}" posted to Twitter.`);

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

    // 3. Post the article to Facebook
    const facebookUserId = Resource.FacebookUserId.value;
    const facebookUserAccessToken = Resource.FacebookUserAccessToken.value;
    const facebookPageId = Resource.FacebookPageId.value;

    if (facebookUserId && facebookUserAccessToken && facebookPageId) {
      const facebookPageAccessToken = await getFacebookPageAccessToken(facebookUserId, facebookUserAccessToken, facebookPageId);

      if (facebookPageAccessToken) {
        try {
          const facebookPostMessage = `📰 ${articleToPost.title}\n\nRead more: https://www.fauxios.com/articles/${articleToPost.articleId}${hashtagsString}`;
          let facebookImageUrl = articleToPost.imageUrl; // Default to original image URL

          if (articleToPost.imageVariations && articleToPost.imageVariations['social-square']) {
            facebookImageUrl = articleToPost.imageVariations['social-square'];
          }

          const facebookPostData = {
            message: facebookPostMessage,
            url: facebookImageUrl, // Use 'url' for image posts
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
      console.log("Missing Facebook User ID, User Access Token, or Page ID. Skipping Facebook post.");
    }

    // 4. Update the article's postedToSocial status in DynamoDB
    const updateCommand = new UpdateItemCommand({
      TableName: articlesTableName,
      Key: { articleId: { S: articleToPost.articleId } },
      UpdateExpression: "SET postedToSocial = :postedToSocial",
      ExpressionAttributeValues: {
        ":postedToSocial": { S: "true" },
      },
    });
    await ddbClient.send(updateCommand);
    console.log(`Article "${articleToPost.title}" marked as posted.`);

  } catch (error) {
    console.error("Error in SocialMediaPoster:", error);
    throw error;
  }
  console.log("SocialMediaPoster handler finished.");
}
