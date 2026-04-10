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
        console.error("Error fetching Facebook Page Access Token:", error);
        return undefined;
      }
    }

    const facebookUserId = Resource.FacebookUserId.value;
    const facebookUserAccessToken = Resource.FacebookUserAccessToken.value;
    const facebookPageId = Resource.FacebookPageId.value;

    if (facebookUserId && facebookUserAccessToken && facebookPageId) {
      const facebookPageAccessToken = await getFacebookPageAccessToken(facebookUserId, facebookUserAccessToken, facebookPageId);

      if (facebookPageAccessToken) {
        try {
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
        } catch (facebookError: any) {
          console.error("Error posting video to Facebook:", facebookError.message || facebookError.response?.data || facebookError);
        }
      } else {
        console.log("Failed to obtain Facebook Page Access Token. Skipping.");
      }
    } else {
        console.log("Missing Facebook credentials. Skipping.");
    }

    return { status: "SUCCESS" };

  } catch (error) {
    console.error("Error in PostRevolutionReelToFacebook handler:", error);
    throw error;
  }
};
