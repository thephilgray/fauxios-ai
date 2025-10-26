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

    const processedImagesBucket = new sst.aws.Bucket("ProcessedImages", {
      public: true, // Make processed images publicly accessible
    });

    const twitterApiKey = new sst.Secret("TwitterApiKey");
    const twitterApiSecret = new sst.Secret("TwitterApiSecret");
    const twitterAccessToken = new sst.Secret("TwitterAccessToken");
    const twitterAccessTokenSecret = new sst.Secret("TwitterAccessTokenSecret");
    const facebookUserId = new sst.Secret("FacebookUserId");
    const facebookUserAccessToken = new sst.Secret("FacebookUserAccessToken");
    const facebookPageId = new sst.Secret("FacebookPageId");
    const geminiApiKey = new sst.Secret("GeminiApiKey");
    const newsdataApiKey = new sst.Secret("NewsdataApiKey");
    const pineconeApiKey = new sst.Secret("PineconeApiKey");

    // New Step Function Workflow
    const generateArticleContent = new sst.aws.Function("GenerateArticleContent", {
      handler: "src/functions/generateArticleContent.handler",
      link: [articlesTable, authorsTable, geminiApiKey, newsdataApiKey, pineconeApiKey],
      timeout: "60 seconds",
    });

    const generateArticleImage = new sst.aws.Function("GenerateArticleImage", {
      handler: "src/functions/generateArticleImage.handler",
      link: [geminiApiKey, imagesBucket, processedImagesBucket],
      nodejs: { install: ["sharp"] },
      timeout: "60 seconds",
    });

    const assemblePost = new sst.aws.Function("AssemblePost", {
      handler: "src/functions/assemblePost.handler",
      link: [articlesTable],
      timeout: "30 seconds",
    });

    const postToSocials = new sst.aws.Function("PostToSocials", {
      handler: "src/functions/postToSocials.handler",
      link: [articlesTable, twitterApiKey, twitterApiSecret, twitterAccessToken, twitterAccessTokenSecret, facebookUserId, facebookUserAccessToken, facebookPageId],
      timeout: "30 seconds",
    });

    // Define states using SST's fluent API
    const generateContentState = sst.aws.StepFunctions.lambdaInvoke({
      name: "GenerateArticleContent",
      function: generateArticleContent,
      output: {
        article: "{% $states.result.Payload %}",
      },
    });

    const generateArticleImageState = sst.aws.StepFunctions.lambdaInvoke({
      name: "GenerateArticleImage",
      function: generateArticleImage,
      payload: { article: "{% $states.input.article %}" },
      output: {
        article: "{% $states.input.article %}",
        images: "{% $states.result.Payload %}",
      },
    });

    const assemblePostState = sst.aws.StepFunctions.lambdaInvoke({
      name: "AssemblePost",
      function: assemblePost,
      payload: {
        articleData: "{% $states.input.article %}",
        imageData: "{% $states.input.images %}",
      },
      output: {
        assembledPost: "{% $states.result.Payload %}",
      },
    });

    const postToSocialsState = sst.aws.StepFunctions.lambdaInvoke({
      name: "PostToSocials",
      function: postToSocials,
      payload: { articleToPost: "{% $states.input.assembledPost %}" },
    });

    const definition = generateContentState
      .next(generateArticleImageState)
      .next(assemblePostState)
      .next(postToSocialsState);

    const stateMachine = new sst.aws.StepFunctions("FauxiosOrchestrator", {
      definition: definition,
    });

    // New Cron job to trigger the Step Function via a lambda
    if ($app.stage !== "phillipgray") {
      new sst.aws.Cron("FauxiosOrchestratorCron", {
        schedule: "rate(1 day)",
        job: {
          handler: "src/functions/orchestratorTrigger.handler",
          link: [stateMachine],
        },
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
      environment: {
        PUBLIC_ADSENSE_ENABLED: "false", // Set to "true" when AdSense is approved
      },
    });

    // Video Generation Service
    const videoAssetsBucket = new sst.aws.Bucket("VideoAssets");

    const runwayApiKey = new sst.Secret("RunwayApiKey");

    // Lambdas for asset generation
    const generateVoiceover = new sst.aws.Function("GenerateVoiceover", {
      handler: "src/functions/generateVoiceover.handler",
      link: [videoAssetsBucket],
      permissions: [{ actions: ["polly:SynthesizeSpeech"], resources: ["*"] }],
      timeout: "3 minutes",
    });

    // const animateCartoon = new sst.aws.Function("AnimateCartoon", {
    //   handler: "src/functions/animateCartoon.handler",
    //   link: [videoAssetsBucket],
    //   timeout: "3 minutes",
    //   environment: {
    //     RUNWAYML_API_SECRET: runwayApiKey.value
    //   },
    // });

    const generateAvatar = new sst.aws.Function("GenerateAvatar", {
      handler: "src/functions/generateAvatar.handler",
      link: [videoAssetsBucket],
      environment: {
        RUNWAYML_API_SECRET: runwayApiKey.value
      },
      timeout: "3 minutes",
    });

    // New Lambda for orchestrating Remotion rendering
    const renderVideo = new sst.aws.Function("RenderVideo", {
      handler: "src/functions/renderVideo.handler", // Explicitly specify the handler function
      link: [videoAssetsBucket],
      timeout: "15 minutes", // Remotion rendering can take a while
      memory: "2048 MB", // Adjust based on Remotion's needs
      // Permissions to invoke the Remotion Lambda renderer
      permissions: [
        {
          actions: ["lambda:InvokeFunction"],
          resources: ["arn:aws:lambda:us-east-1:856562418824:function:remotion-render-4-0-365-mem2048mb-disk2048mb-120sec"],
        },
      ],
    });


    const generateVoiceoverState = sst.aws.StepFunctions.lambdaInvoke({
      name: "GenerateVoiceover",
      function: generateVoiceover,
      payload: {
        headline: "{% $states.input.headline %}",
        originalInput: "{% $states.input %}",
      },
      output: {
        voiceoverUrl: "{% $states.result.Payload.voiceoverUrl %}",
        originalInput: "{% $states.result.Payload.originalInput %}",
      },
    });

    const generateAvatarState = sst.aws.StepFunctions.lambdaInvoke({
      name: "GenerateAvatar",
      function: generateAvatar,
      output: {
        avatarVideoUrl: "{% $states.result.Payload.avatarVideoUrl %}",
        avatarVideoDuration: "{% $states.result.Payload.duration %}",
      },
    });

    const parallelState = sst.aws.StepFunctions.parallel({
      name: "GenerateAssetsInParallel",
    }).branch(generateVoiceoverState).branch(generateAvatarState);

    const renderState = sst.aws.StepFunctions.lambdaInvoke({
      name: "RenderFinalVideo",
      function: renderVideo, // Invoke the newly defined renderVideo function
      payload: {
        headline: "{% $states.input[0].originalInput.headline %}",
        quote: "{% $states.input[0].originalInput.quote %}",
        author: "{% $states.input[0].originalInput.author %}",
        voiceoverUrl: "{% $states.input[0].voiceoverUrl %}",
        cartoonImageUrl: "{% $states.input[0].originalInput.cartoonImage %}",
        avatarVideoUrl: "{% $states.input[1].avatarVideoUrl %}",
        avatarVideoDuration: "{% $states.input[1].avatarVideoDuration %}",
      },
    });
    const videoOrchestrator = new sst.aws.StepFunctions("VideoOrchestrator", {
      definition: parallelState.next(renderState),
    });

    return {
      url: site.url,
      apiUrl: api.url,
      videoOrchestratorArn: videoOrchestrator.arn,
    };
  },
});