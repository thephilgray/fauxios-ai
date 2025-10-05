# Future Article Popularity Tracking and Social Media Polling

This document preserves the initial efforts and ideas for tracking article popularity and polling social media, which were temporarily removed from `sst.config.ts` to streamline the current development focus.

## Components and Their Purpose:

### 1. Social Media Poster Cron Function (`socialMediaPosterCronFunction`)
*   **Purpose:** This function was intended to periodically post articles to social media platforms. While the primary `SocialMediaPoster` function handles immediate posting, this cron function would ensure a continuous presence or catch any articles missed by immediate triggers.
*   **SST Configuration:**
    ```typescript
    const socialMediaPosterCronFunction = new sst.aws.Function("SocialMediaPosterCronFunction", {
      handler: "src/functions/socialMediaPoster.handler", // Same handler as socialMediaPoster
      link: [articlesTable, twitterApiKey, twitterApiSecret, twitterAccessToken, twitterAccessTokenSecret], // Link the Articles table to this explicit cron function
    });
    ```
*   **Associated File Content (`src/functions/socialMediaPoster.ts` - relevant parts):**
    (Note: The full content of `socialMediaPoster.ts` is not included here as it's a core function, but its cron configuration is noted.)

### 2. Social Engagement Tracker (`socialEngagementTracker` and `socialEngagementTrackerCronFunction`)
*   **Purpose:** These functions were designed to track engagement metrics (likes, shares, comments) for articles on social media platforms. The cron function would run periodically to update these metrics in the `Articles` DynamoDB table.
*   **SST Configuration:**
    ```typescript
    const socialEngagementTracker = new sst.aws.Function("SocialEngagementTracker", {
      handler: "src/functions/socialEngagementTracker.handler",
      link: [articlesTable], // Grant access to the Articles table
    });

    const socialEngagementTrackerCronFunction = new sst.aws.Function("SocialEngagementTrackerCronFunction", {
      handler: "src/functions/socialEngagementTracker.handler", // Same handler as socialEngagementTracker
      link: [articlesTable], // Link the Articles table to this explicit cron function
    });

    new sst.aws.Cron("SocialEngagementTrackerCron", {
      schedule: "rate(6 hours)", // Example: Run every 6 hours to update engagement metrics
      job: socialEngagementTrackerCronFunction.arn, // Reference the explicit function
    });
    ```
*   **Associated File Content (`src/functions/socialEngagementTracker.ts`):**
    ```typescript
    import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
    import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
    import { Resource } from "sst";

    const ddbClient = new DynamoDBClient({});
    const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

    export async function handler() {
      console.log("SocialEngagementTracker handler started.");
      try {
        // 1. Scan the Articles table to get all articles
        const articlesTableName = Resource.Articles.name;
        const scanCommand = new ScanCommand({ TableName: articlesTableName });
        const { Items: articles } = await ddbDocClient.send(scanCommand);

        if (!articles || articles.length === 0) {
          console.log("No articles found to track engagement for.");
          return;
        }

        console.log(`Found ${articles.length} articles to track engagement for.`);

        for (const article of articles) {
          // 2. Query social media APIs for engagement metrics for each article
          // This is a placeholder. You'll need to integrate with specific social media APIs.
          // You'll likely need to store the social media post ID with the article when it's posted.

          // Example: Simulate fetching engagement metrics
          const simulatedLikes = Math.floor(Math.random() * 100);
          const simulatedShares = Math.floor(Math.random() * 50);
          const simulatedComments = Math.floor(Math.random() * 20);

          console.log(`Article: "${article.headline}" - Likes: ${simulatedLikes}, Shares: ${simulatedShares}, Comments: ${simulatedComments}`);

          // 3. Update the Articles table with the new engagement metrics
          const updateCommand = new UpdateCommand({
            TableName: articlesTableName,
            Key: { articleId: article.articleId },
            UpdateExpression: "SET likes = :l, shares = :s, comments = :c",
            ExpressionAttributeValues: {
              ":l": simulatedLikes,
              ":s": simulatedShares,
              ":c": simulatedComments,
            },
          });
          await ddbDocClient.send(updateCommand);
          console.log(`Updated engagement for article: "${article.headline}"`);
        }

      } catch (error) {
        console.error("Error in SocialEngagementTracker:", error);
        throw error;
      }
      console.log("SocialEngagementTracker handler finished.");
    }
    ```

### 3. Social Media Poller (`pollSocialMedia` and `PollSocialMediaCron`)
*   **Purpose:** This function was intended to poll social media platforms for new content or updates relevant to the articles, potentially to discover new trends or user-generated content related to Fauxios.
*   **SST Configuration:**
    ```typescript
    const pollSocialMedia = new sst.aws.Function("PollSocialMedia", {
      handler: "src/functions/pollSocialMedia.handler",
      link: [articlesTable],
    });

    new sst.aws.Cron("PollSocialMediaCron", {
      schedule: "rate(24 hours)",
      job: "src/functions/pollSocialMedia.handler",
    });
    ```
*   **Associated File Content (`src/functions/pollSocialMedia.ts` - assumed content):**
    (Note: The content for `pollSocialMedia.ts` was not provided in the previous context, so this is a placeholder. If you had content for it, it would go here.)

### 4. Update Popularity Score (`updatePopularityScore` and `UpdatePopularityScoreCron`)
*   **Purpose:** This function was designed to calculate and update a "popularity score" for articles based on various metrics (e.g., social engagement, views). The cron job would run periodically to re-evaluate and update these scores.
*   **SST Configuration:**
    ```typescript
    const updatePopularityScore = new sst.aws.Function("UpdatePopularityScore", {
      handler: "src/functions/updatePopularityScore.handler",
      link: [articlesTable, catRosterTable],
    });

    new sst.aws.Cron("UpdatePopularityScoreCron", {
      schedule: "rate(7 days)",
      job: "src/functions/updatePopularityScore.handler",
    });
    ```
*   **Associated File Content (`src/functions/updatePopularityScore.ts`):**
    ```typescript
    import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
    import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
    import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

    const ddbClient = new DynamoDBClient({});
    const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

    export const handler: APIGatewayProxyHandlerV2 = async (event) => {
      const scanCommand = new ScanCommand({
        TableName: "Articles",
      });

      const { Items: articles } = await ddbDocClient.send(scanCommand);

      if (!articles) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: "No articles found" }),
        };
      }

      for (const article of articles) {
        const { articleId, likes, reposts } = article;

        const popularityScore = likes + reposts * 2;

        const scanCatRosterCommand = new ScanCommand({
          TableName: "CatRoster",
          FilterExpression: "contains(articles, :articleId)",
          ExpressionAttributeValues: {
            ":articleId": articleId,
          },
        });

        const { Items: cats } = await ddbDocClient.send(scanCatRosterCommand);

        if (cats) {
          for (const cat of cats) {
            const { catId } = cat;

            const updateCommand = new UpdateCommand({
              TableName: "CatRoster",
              Key: {
                catId: catId,
              },
              UpdateExpression: "SET popularity_score = :popularityScore",
              ExpressionAttributeValues: {
                ":popularityScore": popularityScore,
              },
            });

            await ddbDocClient.send(updateCommand);
          }
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Popularity scores updated successfully" }),
      };
    };
    ```

## Re-implementation Notes:
When re-implementing these features in the future, consider:
*   **API Rate Limits:** Be mindful of social media API rate limits when polling or tracking engagement.
*   **Authentication:** Ensure secure handling and refreshing of API tokens.
*   **Scalability:** Design functions to scale with increasing article volume and social media interactions.
*   **Data Storage:** Determine if additional DynamoDB fields or tables are needed to store detailed engagement metrics.
*   **Cost Optimization:** Optimize cron schedules and function invocations to manage AWS costs.