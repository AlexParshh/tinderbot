import type { NextApiRequest, NextApiResponse } from "next";
import { createTinderAxios } from "../../lib/tinderaxios";
import { AxiosInstance } from "axios";
import { z } from "zod";

type ResponseData = {
  message: string;
  matches: any;
};

const requestBodySchema = z.object({
  xAuthToken: z.string(),
  userSessionId: z.string()
});

// request must contian
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === "POST") {
    handlePostRequest(req, res);
  } else {
    res.status(400).json({ matches: null, message: "Invalid request method" });
  }
}

const handlePostRequest = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {

  try {
    const { xAuthToken, userSessionId } = requestBodySchema.parse(req.body);
    const matches = await getMatches(xAuthToken, userSessionId);
    const organizedMatches = organizeMatches(matches);
    res.status(200).json({ matches: organizedMatches, message: "Success." });
  } catch (error) {
    console.error("Invalid request body:", error);
  }

};

const getMatches = async (xAuthToken: string, userSessionId: string) => {
  // const xAuthToken = "ad457a2a-9500-4d9f-8008-f702299086b5";
  // const appSessionId = "3d806021-1a6e-47ae-adc3-8bbfea45e7e3";
  // const userSessionId = "895248a5-e6f7-4a58-b630-ae97a8c7202c";
  // ben info
  // const xAuthToken = "dbdfbecc-3568-49d1-9b5c-9692eba37ccb";
  // const appSessionId = "bb1cdf67-0c12-474e-a98b-81d93fcc96b8";
  // const userSessionId = "a4609f6d-21d0-4ee7-8fa9-9f37e6e9a053";

  const tinderAxios: AxiosInstance = createTinderAxios(
    xAuthToken,
    "",
    userSessionId
  );

  let matches: any = [];
  let nextPageToken = "";
  try {
    while (true) {
      let currentMatchesBatch;

      if (nextPageToken) {
        currentMatchesBatch = await tinderAxios.get(
          `/v2/matches?count=100&page_token=${nextPageToken}`
        );
      } else {
        currentMatchesBatch = await tinderAxios.get(`/v2/matches?count=100`);
      }

      matches = matches.concat(currentMatchesBatch.data.data.matches);

      if (currentMatchesBatch.data.data.next_page_token) {
        nextPageToken = currentMatchesBatch.data.data.next_page_token;
      } else {
        break;
      }
    }

    return matches;
  } catch (e) {
    console.error(e);
    return;
  }
};


// this will categorize matches into different categories:
// 1. messaged: matches that have already been messaged or that have already messaged you first
// 2. unmessaged/unseen: matches that have 0 messages or have not been seen yet
// "matches[i].messages" displays the most recent message and who sent it, which we can use to determine whose
// turn it is in the conversation. If we have already messaged we do not want to generate another follow up.
const organizeMatches = (matches: any) => {

  const messagedMatches = []
  const unMessagedMatches = []

  for (let i = 0; i < matches.length; i++) {

    const currentMatch = matches[i]

    if (currentMatch.messages.length) {
      messagedMatches.push(currentMatch)
    } else {
      unMessagedMatches.push(currentMatch)
    }

  }

  return {
    messagedMatches,
    unMessagedMatches
  };
}