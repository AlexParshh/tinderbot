import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { Configuration, OpenAIApi } from "openai";
import { getMatchProfile, cleanMatchProfile } from "./matchprofile";
import {
  removeEdgeQuotes,
  createPromptForBio,
  createPromptWithoutBio,
} from "../../lib/gpt";

type ResponseData = {
  message: string;
  pickupline: any;
};

const requestBodySchema = z.object({
  userId: z.string(),
  xAuthToken: z.string(),
  userSessionId: z.string(),
});

// request must contian
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method === "POST") {
    handlePostRequest(req, res);
  } else {
    res.status(400).json({ pickupline: "", message: "Invalid request method" });
  }
}

const handlePostRequest = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {
  try {
    const { userId, xAuthToken, userSessionId } = requestBodySchema.parse(
      req.body
    );
    const pickupline = await generatePickupLine(
      xAuthToken,
      userSessionId,
      userId
    );
    res.status(200).json({ pickupline, message: "Success." });
  } catch (error) {
    console.error("Invalid request body:", error);
    res.status(400).json({ pickupline: "", message: "Fail." });
  }
};

// this method will take in a match's profile and generate an opening line to message to them
// the available information that is provided to chatgpt, in terms of importance is:
// 1. Match bio
// 2. Match name
// 3. Match hobbies/interests
const generatePickupLine = async (
  xAuthToken: string,
  userSessionId: string,
  userId: string
) => {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  // first we need to get all of the matches specific information
  const matchProfile = await getMatchProfile(xAuthToken, userSessionId, userId);
  const cleanedMatchProfile = cleanMatchProfile(matchProfile);

  // if the user does not have a bio, use the remaining parts of their profile.
  let prompt;
  if (!cleanedMatchProfile.bio) {
    prompt = createPromptWithoutBio(JSON.stringify(cleanedMatchProfile));
  } else {
    prompt = createPromptForBio(
      JSON.stringify({
        bio: cleanedMatchProfile.bio,
        name: cleanedMatchProfile.name,
      })
    );
  }

  const chatCompletion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
  });

  return removeEdgeQuotes(
    chatCompletion.data.choices[0].message?.content || ""
  );
};
