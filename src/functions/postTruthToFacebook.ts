import { Resource } from "sst";
import axios from 'axios';
import type { Handler } from "aws-lambda";

interface PostToPublish {
  imageUrl: string;
  caption: string;
}

interface PostTruthToFacebookEvent {
  postToPublish: PostToPublish;
}

export const handler: Handler<PostTruthToFacebookEvent> = async (event) => {
  console.log("--- PostTruthToFacebook handler invoked ---");
  console.log("Received payload:", JSON.stringify(event, null, 2));

  const { postToPublish } = event;

  try {
    // Helper function to get Facebook Page Access Token
    async function getFacebookPageAccessToken(userId: string, userAccessToken: string, pageId: string): Promise<string | undefined> {
      try {
        const response = await axios.get(`https://graph.facebook.com/${userId}/accounts?access_token=${userAccessToken}`);
        const pages = response.data.data;
        const targetPage = pages.find((page: any) => page.id === pageId);
        if (targetPage) {
          console.log("Successfully fetched Facebook Page Access Token.");
          return targetPage.access_token;
        } else {
          console.error(`Facebook Page with ID ${pageId} not found among managed pages.`);
          return undefined;
        }
      } catch (error) {
        console.error("Error fetching Facebook Page Access Token:", error);
        return undefined;
      }
    }

    // 1. Post to Facebook
    const facebookUserId = Resource.FacebookUserId.value;
    const facebookUserAccessToken = Resource.FacebookUserAccessToken.value;
    const facebookPageId = Resource.FacebookPageId.value;

    if (facebookUserId && facebookUserAccessToken && facebookPageId) {
      const facebookPageAccessToken = await getFacebookPageAccessToken(facebookUserId, facebookUserAccessToken, facebookPageId);

      if (facebookPageAccessToken) {
        try {
          const facebookPostData = {
            message: postToPublish.caption,
            url: postToPublish.imageUrl, // Use 'url' for image posts
            access_token: facebookPageAccessToken,
          };

          const facebookResponse = await axios.post(
            `https://graph.facebook.com/v19.0/${facebookPageId}/photos`,
            facebookPostData
          );
          console.log("Facebook post successful:", facebookResponse.data);
          console.log(`Truth posted to Facebook.`);
        } catch (facebookError: any) {
          console.error("Error posting to Facebook:", facebookError.message || facebookError.response?.data || facebookError);
        }
      } else {
        console.log("Failed to obtain Facebook Page Access Token. Skipping Facebook post.");
      }
    } else {
        console.log("Missing Facebook credentials. Skipping Facebook post.");
    }

    return { status: "SUCCESS" };

  } catch (error) {
    console.error("Error in PostTruthToFacebook handler:", error);
    throw error;
  }
};
