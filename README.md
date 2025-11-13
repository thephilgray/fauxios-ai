# Fauxios

![Fauxios Logo](./public/images/fauxios-logo.svg)

Fauxios is an automated content generation and social media platform. It leverages AI and serverless technologies to create news articles and videos, and post them to social media channels.

## Table of Contents

- [Architecture](#architecture)
  - [Article Generation](#article-generation)
  - [Video Generation](#video-generation)
- [Setup](#setup)
- [Usage](#usage)
- [Key Technologies](#key-technologies)

## Architecture

The project is built on a serverless architecture using [SST](https://sst.dev/) to manage AWS resources. The frontend is an [Astro](https://astro.build/) site.

### Article Generation

The core of the article generation is an AWS Step Function (`FauxiosOrchestrator`) that automates the following steps:

1.  **Generate Article Content**: A Lambda function (`generateArticleContent`) uses generative AI to write an article.
2.  **Generate Article Image**: A Lambda function (`generateArticleImage`) creates an image for the article.
3.  **Assemble Post**: A Lambda function (`assemblePost`) combines the article content and image into a final post format and stores it in DynamoDB.
4.  **Post to Socials**: A Lambda function (`postToSocials`) posts the generated article to social media platforms like Twitter and Facebook.

This workflow is triggered by a daily cron job.

### Video Generation

Video generation is handled by a separate AWS Step Function (`VideoOrchestrator`) and [Remotion](https://remotion.dev) for rendering.

1.  **Parallel Asset Generation**:
    *   **Voiceover**: An AWS Polly-powered Lambda (`generateVoiceover`) creates a voiceover from a headline.
    *   **Avatar**: A RunwayML-powered Lambda (`generateAvatar`) creates a talking avatar video from a quote.
2.  **Final Video Rendering**:
    *   A final Lambda function (`renderVideo`) invokes a Remotion Lambda function to composite the generated assets (voiceover, animated cartoon, avatar) into a single video.

For more details, see the [Video Generation Architecture](./VIDEO_GENERATION_ARCHITECTURE.md) document.

## Setup

1.  **Prerequisites**:
    *   Node.js (v18 or later)
    *   An AWS account with credentials configured for SST.
    *   [SST CLI](https://docs.sst.dev/install) installed globally.

2.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd fauxios-project
    ```

3.  **Install dependencies**:
    ```bash
    npm install
    ```

4.  **Configure Secrets**:
    This project uses SST's `sst.Secret` to manage API keys and other secrets for services like Twitter, Facebook, Gemini, and RunwayML. You will need to set these secrets in your SST environment.

    Example:
    ```bash
    npx sst secret set TwitterApiKey "your_api_key" --stage dev
    ```
    Refer to `sst.config.ts` for the full list of secrets required.

## Usage

### Deploying to AWS

To deploy the entire stack (including the Astro site, APIs, and all serverless functions) to your AWS account, run:

```bash
sst deploy --stage dev
```

### Local Development

To run the Astro frontend locally for development:

```bash
sst dev
```

This will start a local development server at `http://localhost:4321`.

### Invoking Workflows

To manually trigger the article generation workflow, you can use the SST shell to execute scripts in the context of your deployed backend.

```bash
sst shell --stage dev -- node packages/scripts/invoke-generator.ts
```

This command runs the `invoke-generator.ts` script, which starts an execution of the `FauxiosOrchestrator` Step Function.

## Key Technologies

-   **Frontend**: [Astro](https://astro.build/)
-   **Backend & IaC**: [SST](https://sst.dev/)
-   **Database**: [Amazon DynamoDB](https://aws.amazon.com/dynamodb/)
-   **Storage**: [Amazon S3](https://aws.amazon.com/s3/)
-   **Orchestration**: [AWS Step Functions](https://aws.amazon.com/step-functions/)
-   **Video Rendering**: [Remotion](https://www.remotion.dev/)
-   **Generative AI**:
    -   [Google Gemini](https://gemini.google.com/)
    -   [RunwayML](https://runwayml.com/)
    -   [Amazon Polly](https://aws.amazon.com/polly/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)