## Notes for Integrating Facebook Posting

Integrating Facebook posting into your `socialMediaPoster.ts` function involves significant work with the Facebook Graph API. It's more complex than Twitter integration due to Facebook's stricter API policies and authentication flows.

### High-Level Overview of Steps:

1.  **Facebook Developer Account & App Setup:**
    *   Create a Facebook Developer account.
    *   Create a new Facebook App within your developer account.
    *   Configure the app for the appropriate use case (e.g., "Business" or "Marketing").
    *   Add the necessary products to your app, primarily the "Facebook Login" and "Marketing API" (or "Graph API") products.

2.  **Obtain a Page Access Token:**
    *   To post to a Facebook Page, your application needs a **Page Access Token**. This token grants your app permission to post on behalf of that specific page.
    *   Obtaining this token is the most complex part. It typically involves:
        *   A Facebook user (who is an admin of the target Facebook Page) logging into your app via Facebook Login.
        *   Your app requesting specific permissions (e.g., `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`).
        *   Exchanging a short-lived User Access Token for a long-lived one.
        *   Then, using the long-lived User Access Token to request a Page Access Token for the desired page.
    *   **This Page Access Token is crucial and must be stored securely as an SST Secret**, similar to your Twitter API keys. You'll need to handle token expiration and refreshing if you want long-term automation.

3.  **Install a Facebook Graph API Client (Recommended):**
    *   While you can make raw HTTP requests to the Facebook Graph API, using a dedicated Node.js client library (if available and well-maintained) can simplify interactions. Otherwise, you'd use a library like `axios` for HTTP requests.

4.  **Modify `sst.config.ts`:**
    *   You'll need to add new SST Secrets to store your Facebook Page Access Token (and potentially your Facebook App ID and App Secret if you plan to implement token refreshing logic).

5.  **Modify `src/functions/socialMediaPoster.ts`:**
    *   **Import necessary libraries:** Import your chosen Facebook API client or `axios`.
    *   **Retrieve Facebook Credentials:** Get the Facebook Page Access Token from SST Secrets.
    *   **Construct Post Content:** Prepare the text and image (you'll likely need the public URL of the image, similar to how you handle Twitter images).
    *   **Make API Call to Facebook:** Use the Facebook Graph API to publish content to your page. Common endpoints include:
        *   `POST /{page-id}/photos` for posting an image with a caption.
        *   `POST /{page-id}/feed` for posting a text message or a link.
    *   **Error Handling:** Implement robust `try-catch` blocks for Facebook API calls.
    *   **Update DynamoDB:** After successful posting, update the article's status in DynamoDB (you might want a separate `postedToFacebook` flag).

### Important Considerations:

*   **Facebook's API Changes:** Facebook's API is known to change frequently, so you'll need to stay updated with their documentation.
*   **App Review:** For certain permissions or if your app is used by many users, Facebook might require an App Review process.
*   **User Experience:** The initial setup for obtaining the Page Access Token can be a one-time manual process or require building a small UI for an admin to authorize your app.
