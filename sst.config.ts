/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "fauxios-project",
      home: "aws",
      region: "us-east-1",
    };
  },
  async run() {
    const articlesTable = new sst.aws.Dynamo("Articles", {
      fields: {
        articleId: "string",
        createdAt: "string", // Add createdAt field for the GSI
        postedToSocial: "string", // Add postedToSocial field
      },
      primaryIndex: {
        hashKey: "articleId",
      },
      globalIndexes: {
        "createdAt-index": {
          hashKey: "createdAt", // Hash key for the GSI
          rangeKey: "articleId", // Sort key for the GSI (optional, but good for uniqueness)
          projection: "all", // Project all attributes into the index
        },
        "postedToSocial-index": { // New GSI for postedToSocial
          hashKey: "postedToSocial",
          rangeKey: "createdAt", // Sort by creation date for unposted articles
          projection: "all",
        },
      },
    });

    const authorsTable = new sst.aws.Dynamo("Authors", {
      fields: {
        authorId: "string",
      },
      primaryIndex: {
        hashKey: "authorId",
      },
    });

    const imagesBucket = new sst.aws.Bucket("Images", {
      public: true, // Make images publicly accessible,
    });

    const embeddingsBucket = new sst.aws.Bucket("Embeddings", {
      public: false, // Embeddings don't need to be publicly accessible
    });

    const processedImagesBucket = new sst.aws.Bucket("ProcessedImages", {
      public: true, // Make processed images publicly accessible
    });

    const twitterApiKey = new sst.Secret("TwitterApiKey");
    const twitterApiSecret = new sst.Secret("TwitterApiSecret");
    const twitterAccessToken = new sst.Secret("TwitterAccessToken");
    const twitterAccessTokenSecret = new sst.Secret("TwitterAccessTokenSecret");
    const facebookPageAccessToken = new sst.Secret("FacebookPageAccessToken");

    const socialMediaPoster = new sst.aws.Function("SocialMediaPoster", {
      handler: "src/functions/socialMediaPoster.handler",
      link: [articlesTable, twitterApiKey, twitterApiSecret, twitterAccessToken, twitterAccessTokenSecret, facebookPageAccessToken, processedImagesBucket], // Grant access to the Articles table
    });

    const imageProcessor = new sst.aws.Function("ImageProcessor", {
      handler: "src/functions/imageProcessor.handler",
      link: [articlesTable, imagesBucket, processedImagesBucket, socialMediaPoster], // Link to Articles table, original Images bucket, and new Processed Images bucket
      timeout: "60 seconds", // Image processing can be intensive
      concurrency: {
        reserved: 1, // Limit to 1 concurrent invocation
      },
      nodejs: { install: ["sharp", "@aws-sdk/client-lambda"] },
      environment: {
        PROCESSED_IMAGES_BUCKET_NAME: processedImagesBucket.name, // Pass bucket name as env var
      },
    });

    imagesBucket.notify({
      notifications: [
        {
          name: "processImageNotification", // Add a unique name for this notification
          function: imageProcessor.arn,
          events: ["s3:ObjectCreated:*"], // Trigger on all object creation events
          filterPrefix: "articles/", // Only process images in the 'articles/' folder
        },
      ],
    });

    const geminiApiKey = new sst.Secret("GeminiApiKey");
    const newsdataApiKey = new sst.Secret("NewsdataApiKey");

    const fauxiosGeneratorFunction = new sst.aws.Function("FauxiosGenerator", {
      handler: "src/functions/fauxiosGenerator.handler",
      link: [
        articlesTable,
        authorsTable,
        geminiApiKey,
        newsdataApiKey,
        imagesBucket,
        embeddingsBucket, // Link the new embeddings bucket
      ],
      memory: "1024 MB", // Increase memory for large embeddings file
      timeout: "60 seconds", // Increase timeout for image generation
      concurrency: {
        reserved: 1, // Limit to 1 concurrent invocation
      },
    });

    if ($app.stage !== "phillipgray") {
      new sst.aws.Cron("FauxiosGeneratorCron", {
        schedule: "rate(24 hours)",
        job: fauxiosGeneratorFunction.arn, // Link to the ARN of the Function construct
      });
    }    
    
    const api = new sst.aws.ApiGatewayV2("Api"); // Changed to ApiGatewayV2
    api.route("GET /articles", {
      handler: "src/functions/articles.handler",
      link: [articlesTable],
    });
    api.route("GET /articles/{articleId}", {
      handler: "src/functions/articles.handler",
      link: [articlesTable],
    });

    const site = new sst.aws.Astro("site", {
      link: [articlesTable, authorsTable, api],
      domain: {
        name: $app.stage === "dev" ? "fauxios.com" : `${$app.stage}.fauxios.com`,
        redirects: $app.stage === "dev" ? ["www.fauxios.com"] : [],
      },
    });

    return {
      url: site.url,
      apiUrl: api.url,
    };
  },
});