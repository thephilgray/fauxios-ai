
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

async function clearArticlesByDate(dateString: string) {
  const tableName = Resource.Articles.name;
  const endDate = new Date(dateString);

  console.log(`Scanning table: ${tableName} to clear items on or before ${endDate.toISOString()}.`);

  try {
    const scanCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: "createdAt <= :endDate",
      ExpressionAttributeValues: {
        ":endDate": endDate.toISOString(),
      },
      ProjectionExpression: "articleId", // Only need the primary key for deletion
    });

    const { Items } = await ddbDocClient.send(scanCommand);

    if (!Items || Items.length === 0) {
      console.log("No articles found on or before the specified date.");
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

    console.log("Successfully cleared articles from the table based on the date provided.");
  } catch (error) {
    console.error("Error clearing articles table:", error);
  }
}

const dateArg = process.argv[2];
if (!dateArg) {
  console.error("Please provide a date string as an argument (e.g., '2023-10-27').");
  process.exit(1);
}

clearArticlesByDate(dateArg);
