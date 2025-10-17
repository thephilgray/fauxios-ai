import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const authors = [
  { authorId: "author-1", name: "Publius" },
  { authorId: "author-2", name: "Brutus" },
  { authorId: "author-3", name: "Cato" },
  { authorId: "author-4", name: "A Farmer" },
];

async function seedAuthors() {
  const tableName = Resource.Authors.name;

  const putRequests = authors.map(author => ({
    PutRequest: {
      Item: author,
    },
  }));

  const command = new BatchWriteCommand({
    RequestItems: {
      [tableName]: putRequests,
    },
  });

  try {
    await ddbDocClient.send(command);
    console.log(`Successfully seeded ${authors.length} authors into the ${tableName} table.`);
  } catch (error) {
    console.error("Error seeding authors:", error);
  }
}

seedAuthors();
