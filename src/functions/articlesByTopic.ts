import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export async function handler(event: any) {
  try {
    const articlesTableName = Resource.Articles.name;
    const topic = decodeURIComponent(event.pathParameters?.topic || '');

    if (!topic) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Topic is required" }),
      };
    }

    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 10;
    const exclusiveStartKey = event.queryStringParameters?.exclusiveStartKey
      ? JSON.parse(event.queryStringParameters.exclusiveStartKey)
      : undefined;

    const queryCommand = new QueryCommand({
      TableName: articlesTableName,
      IndexName: "topic-index",
      KeyConditionExpression: "topic = :topic",
      ExpressionAttributeValues: {
        ":topic": topic,
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
  } catch (error) {
    console.error("Error in articlesByTopic handler:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
}
