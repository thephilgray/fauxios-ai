import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

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
      // Get articles with pagination
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 10;
      const exclusiveStartKey = event.queryStringParameters?.exclusiveStartKey
        ? JSON.parse(event.queryStringParameters.exclusiveStartKey)
        : undefined;

      const queryCommand = new QueryCommand({
        TableName: articlesTableName,
        IndexName: "postedToSocial-index",
        KeyConditionExpression: "postedToSocial = :postedToSocial",
        ExpressionAttributeValues: {
          ":postedToSocial": "true",
        },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
      });

      const { Items: articles, LastEvaluatedKey: lastEvaluatedKey } = await ddbDocClient.send(queryCommand);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articles: articles || [],
          lastEvaluatedKey: lastEvaluatedKey,
        }),
      };
    }
  }
  catch (error) {
    console.error("Error in articles handler:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
}
