import { Resource } from "sst";
import axios from 'axios';
import type { Handler } from "aws-lambda";

interface PostRevolutionReelEvent {
  videoUrl: string;
  caption: string;
}

export const handler: Handler<PostRevolutionReelEvent> = async (event) => {
  console.log("--- PostRevolutionReelToFacebook handler invoked ---");
  console.log("Received payload:", JSON.stringify(event, null, 2));

  const { videoUrl, caption } = event;

  try {
    async function getFacebookPageAccessToken(userId: string, userAccessToken: string, pageId: string): Promise<string | undefined> {
      try {
        const response = await axios.get(`https://graph.facebook.com/${userId}/accounts?access_token=${userAccessToken}`);
        const targetPage = response.data.data.find((page: any) => page.id === pageId);
        if (targetPage) {
          return targetPage.access_token;
        } else {
          console.error(`Facebook Page with ID ${pageId} not found among managed pages.`);
          return undefined;
        }
      } catch (error) {
        console.error("Error fetching Facebook Page Access Token from Graph API:", error);
        return undefined;
      }
    }

    const facebookUserId = Resource.FacebookUserId.value;
    const facebookUserAccessToken = Resource.FacebookUserAccessToken.value;
    const facebookPageId = Resource.FacebookPageId.value;
    const fallbackPageAccessToken = Resource.FacebookPageAccessToken.value;

    let facebookPageAccessToken = fallbackPageAccessToken;

    // Favor dynamic token fetching to prevent expiration
    if (facebookUserId && facebookUserAccessToken && facebookPageId) {
      const dynamicToken = await getFacebookPageAccessToken(facebookUserId, facebookUserAccessToken, facebookPageId);
      if (dynamicToken) {
        facebookPageAccessToken = dynamicToken;
      } else {
        console.log("Dynamically fetching token failed or returned empty. Using fallback secret token.");
      }
    }

    if (!facebookPageAccessToken) {
      throw new Error("No Facebook Page Access Token available (dynamic or fallback). Aborting.");
    }

    const facebookPostData = {
      description: caption,
      file_url: videoUrl,
      access_token: facebookPageAccessToken,
    };

    const facebookResponse = await axios.post(
      `https://graph.facebook.com/v19.0/${facebookPageId}/videos`,
      facebookPostData
    );
    console.log("Facebook video reel post successful:", facebookResponse.data);

    return { status: "SUCCESS" };

  } catch (error: any) {
    console.error("Error in PostRevolutionReelToFacebook handler:", error.message || error.response?.data || error);
    throw error;
  }
};
