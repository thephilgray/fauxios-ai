import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

async function scanTopics() {
  const articlesTableName = Resource.Articles.name;

  // Scan for all articles
  const scanCommand = new ScanCommand({
    TableName: articlesTableName,
    ProjectionExpression: "articleId, topic",
  });

  const { Items: articles } = await ddbDocClient.send(scanCommand);

  if (!articles || articles.length === 0) {
    console.log("No articles found.");
    return;
  }

  console.log(`Found ${articles.length} articles. Logging topics:`);

  for (const article of articles) {
    console.log(`ArticleId: ${article.articleId}, Topic: ${article.topic}`);
  }
}

scanTopics();
