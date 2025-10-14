import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

const COMPRESSED_OUTPUT_FILE = path.join(process.cwd(), "assets", "embeddings.json.gz");
const S3_BUCKET_NAME = "fauxios-project-dev-embeddingsbucket-nbecxnet"; // Replace with your actual bucket name
const S3_KEY = "embeddings.json.gz";

async function uploadEmbeddings() {
  console.log("Starting S3 upload for compressed embeddings...");

  if (!fs.existsSync(COMPRESSED_OUTPUT_FILE)) {
    console.error(`Error: Compressed embeddings file not found at ${COMPRESSED_OUTPUT_FILE}`);
    process.exit(1);
  }

  const s3Client = new S3Client({});

  try {
    const compressedEmbeddings = fs.readFileSync(COMPRESSED_OUTPUT_FILE);

    const putObjectCommand = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: S3_KEY,
      Body: compressedEmbeddings,
      ContentType: "application/gzip",
    });

    await s3Client.send(putObjectCommand);
    console.log(`Successfully uploaded ${COMPRESSED_OUTPUT_FILE} to s3://${S3_BUCKET_NAME}/${S3_KEY}`);
  } catch (error) {
    console.error("Error uploading embeddings to S3:", error);
    process.exit(1);
  }
}

uploadEmbeddings();
