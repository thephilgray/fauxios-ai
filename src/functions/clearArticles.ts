import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export async function handler() {
  const tableName = Resource.Articles.name;
  console.log(`Scanning table: ${tableName} to clear all items.`);

  try {
    const scanCommand = new ScanCommand({
      TableName: tableName,
      ProjectionExpression: "articleId", // Only need the primary key for deletion
    });

    const { Items } = await ddbDocClient.send(scanCommand);

    if (!Items || Items.length === 0) {
      console.log("Articles table is already empty.");
      return;
    }

    console.log(`Found ${Items.length} articles to delete.`);

    // DynamoDB BatchWriteCommand can handle up to 25 items at a time
    const deleteRequests = Items.map((item) => ({
      DeleteRequest: {
        Key: { articleId: item.articleId },
      },
    }));

    for (let i = 0; i < deleteRequests.length; i += 25) {
      const batch = deleteRequests.slice(i, i + 25);
      const batchWriteCommand = new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch,
        },
      });
      await ddbDocClient.send(batchWriteCommand);
      console.log(`Deleted a batch of ${batch.length} articles.`);
    }

    console.log("Successfully cleared all articles from the table.");
  } catch (error) {
    console.error("Error clearing articles table:", error);
  }
}
