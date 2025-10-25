# Fauxios Video Generation State Machine

This document outlines the architecture and step-by-step workflow of the Fauxios video generation service, orchestrated by an AWS Step Function.

## High-Level Overview

The purpose of this state machine is to automate the creation of a three-act video based on a news headline, a political cartoon, and a historical quote. It takes these inputs, generates the necessary video and audio assets in parallel, and then renders them into a single, final video file using Remotion and AWS Lambda.

### Visual Workflow

```
[START]
   |
   V
[Input JSON]
{ headline, cartoonImage, quote, author }
   |
   V
[Parallel State: GenerateAssets]
   |
   |--- [Branch A: GenerateVoiceover Lambda] ---> (voiceover.mp3)
   |
   |--- [Branch B: AnimateCartoon Lambda] ---> (cartoon.mp4)
   |
   |--- [Branch C: GenerateAvatar Lambda] ---> (avatar.mp4)
   |
   V
[Combine & Prepare Props]
{ ..., generatedAssets: { voiceoverUrl, ... } }
   |
   V
[Final Step: renderVideo Lambda]
   (Invokes Remotion Lambda to render all assets into one video)
   |
   V
(final_video.mp4)
   |
   V
[Output JSON]
{ videoUrl: "..." }
   |
   V
[END]
```

---

## Step-by-Step Workflow

### 1. Trigger and Input

The state machine is initiated with a single JSON object containing all the necessary data for the video.

**Example Input:**
```json
{
  "headline": "AI Discovers Revolutionary New Path to Liberty",
  "cartoonImage": "https://your-bucket.s3.amazonaws.com/path/to/cartoon.jpg",
  "quote": "The tree of liberty must be refreshed from time to time with the blood of patriots and tyrants.",
  "author": "Thomas Jefferson"
}
```
- `headline`: The text for the Act 1 voiceover.
- `cartoonImage`: A URL to the image that will be animated for Act 2.
- `quote` & `author`: The text and attribution for the Act 3 talking avatar.

### 2. Parallel Asset Generation (`GenerateAssets`)

To work efficiently, the state machine executes three Lambda functions simultaneously. Each function is responsible for creating one of the core assets for the video.

-   **`GenerateVoiceover` Lambda (Branch A)**
    -   **Action**: Takes the `headline` text and uses **AWS Polly** to synthesize a newscaster-style voiceover.
    -   **Output**: Saves the resulting `.mp3` file to an S3 bucket.

-   **`AnimateCartoon` Lambda (Branch B)**
    -   **Action**: Takes the `cartoonImage` URL and sends it to the **RunwayML Gen-2 API** to generate an animated video from the image.
    -   **Output**: Saves the resulting `.mp4` file to an S3 bucket.

-   **`GenerateAvatar` Lambda (Branch C)**
    -   **Action**: Takes the `quote` and `author` text and calls the **RunwayML Gen-1 API** to generate a text-to-video talking avatar.
    -   **Output**: Saves the resulting `.mp4` file to an S3 bucket.

### 3. Data Aggregation

After all three branches complete, the Step Function aggregates their outputs (presigned URLs to the assets) and passes them to the final step.

### 4. Final Video Rendering (`renderVideo`)

The last step is a Lambda function that assembles the final video by invoking the Remotion rendering infrastructure on AWS.

-   **`renderVideo` Lambda (`src/functions/renderVideo.ts`)**
    -   **Action**: This function receives the URLs for all the generated assets (the voiceover, the animated cartoon, and the avatar video) as well as the original text inputs.
    -   It then calls the `renderMediaOnLambda` function from the `@remotion/lambda/client` package.
    -   This function tells the Remotion Lambda infrastructure to start a new render, passing in the asset URLs and text as `inputProps` to the React components defined in `packages/video-renderer`.
    -   **Output**: The final, composed video is saved to an S3 bucket.

---

## Remotion Deployment & Updates

The video rendering process relies on two key pieces of AWS infrastructure that are deployed and managed via the Remotion CLI.

> **Note:** For the Remotion CLI to access your AWS account, you must have your credentials defined in a `.env` file in the project root.
> ```
> REMOTION_AWS_SECRET_ACCESS_KEY=your_secret_key
> REMOTION_AWS_ACCESS_KEY_ID=your_access_key_id
> ```
> For a complete guide on creating the necessary IAM user, roles, and permissions, refer to the official documentation: https://www.remotion.dev/docs/lambda/setup

### 1. The Remotion Player Site

The Remotion Lambda renderer uses a headless Google Chrome instance to visit a web page and record the animation. This page, which contains your Remotion composition, must be deployed to a publicly accessible URL (usually an S3 bucket configured for static web hosting).

**To deploy or update the site:**
Run the following command from the project root. This bundles the code in `packages/video-renderer` and uploads it to S3.

```bash
npx remotion lambda sites create packages/video-renderer/src/index.ts --site-name my-fauxios-video
```

The output will give you a `serveUrl` (the URL to the S3 site). This URL must be used in the `renderVideo.ts` function.

### 2. The Remotion Lambda Function

This is the heavy-lifting function that actually performs the video rendering.

**To deploy or update the function:**
Run the following command. This packages the rendering code and deploys it as an AWS Lambda function.

```bash
npx remotion lambda functions deploy
```

The output will give you a `functionName` (the ARN of the Lambda function). This ARN must be used in the `renderVideo.ts` function.

### 3. Triggering the Render with `renderVideo.ts`

The `/src/functions/renderVideo.ts` function acts as the bridge between our Step Function and the Remotion Lambda infrastructure. It is responsible for initiating the render.

It calls `renderMediaOnLambda` with the following critical parameters:
- `functionName`: The ARN of the deployed Remotion Lambda function (from `npx remotion lambda functions deploy`).
- `serveUrl`: The URL of the deployed Remotion player site (from `npx remotion lambda sites create...`).
- `composition`: The ID of the Remotion composition to render.
- `inputProps`: The data from our state machine (headline, asset URLs, etc.) that gets passed to the React components.

This function call returns a `renderId`, which can be used to check the status of the render and retrieve the final video URL upon completion.

---

## Sample Execution Payload

This is a sample JSON payload that can be used to manually trigger the Step Function for testing purposes.

```json
{
  "headline": "ICE windfall from Trump megabill fuels surveillance juggernaut",
  "cartoonImage": "https://en.wikipedia.org/wiki/James_Gillray#/media/File:Gillray_Temperance_051126.jpg",
  "quote": "It is not by the consolidation, or concentration of powers, but by their distribution, that good government is effected.",
  "author": "Thomas Jefferson"
}
```
