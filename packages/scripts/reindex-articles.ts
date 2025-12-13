import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

async function reindexArticles() {
  const articlesTableName = Resource.Articles.name;

  // Scan for all articles
  const scanCommand = new ScanCommand({
    TableName: articlesTableName,
  });

  const { Items: articles } = await ddbDocClient.send(scanCommand);

  if (!articles || articles.length === 0) {
    console.log("No articles found to re-index.");
    return;
  }

  console.log(`Found ${articles.length} articles to re-index.`);

  // Update each article to trigger re-indexing
  for (const article of articles) {
    const updateCommand = new UpdateCommand({
      TableName: articlesTableName,
      Key: {
        articleId: article.articleId,
      },
      UpdateExpression: "SET #updatedAt = :updatedAt, #topic = :topic",
      ExpressionAttributeNames: {
        "#updatedAt": "updatedAt",
        "#topic": "topic",
      },
      ExpressionAttributeValues: {
        ":updatedAt": new Date().toISOString(),
        ":topic": article.topic.toLowerCase(),
      },
    });

    try {
      await ddbDocClient.send(updateCommand);
      console.log(`Re-indexed article: ${article.articleId}`);
    } catch (error) {
      console.error(`Failed to re-index article: ${article.articleId}`, error);
    }
  }

  console.log("Re-indexing complete.");
}

reindexArticles();
