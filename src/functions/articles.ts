import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst"; // Added this line back

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export async function handler(event: any) {
  try {
    const articlesTableName = Resource.Articles.name;

    if (event.pathParameters && event.pathParameters.articleId) {
      // Get single article
      const articleId = event.pathParameters.articleId;
      const getCommand = new GetCommand({
        TableName: articlesTableName,
        Key: { articleId: articleId },
      });
      const { Item: article } = await ddbDocClient.send(getCommand);

      if (article) {
        // Return the article with structured content
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(article),
        };
      } else {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Article not found" }),
        };
      }
    } else {
      // Get all articles
      const scanCommand = new ScanCommand({ TableName: articlesTableName });
      const { Items: articles } = await ddbDocClient.send(scanCommand);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(articles || []),
      };
    }
  } catch (error) {
    console.error("Error in articles handler:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
}
