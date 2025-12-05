/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firebase Cloud Functions for FormLab
 * Secure proxy for Gemini API calls with authentication and rate limiting
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

// Initialize Firebase Admin
admin.initializeApp();

// Rate limiting configuration
const RATE_LIMITS = {
  hourly: 100, // requests per hour per user
  daily: 500, // requests per day per user
};

/**
 * Check rate limits for a user
 */
async function checkRateLimit(userId: string): Promise<void> {
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  const dayAgo = now - (24 * 60 * 60 * 1000);

  const db = admin.firestore();
  const userDoc = db.collection("usage").doc(userId);

  const doc = await userDoc.get();
  const data = doc.data() || { requests: [] };

  // Clean old requests
  const requests: number[] = data.requests.filter((ts: number) => ts > dayAgo);

  // Check limits
  const hourlyRequests = requests.filter((ts: number) => ts > hourAgo).length;
  const dailyRequests = requests.length;

  if (hourlyRequests >= RATE_LIMITS.hourly) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      `Hourly rate limit exceeded. Limit: ${RATE_LIMITS.hourly} requests/hour`
    );
  }

  if (dailyRequests >= RATE_LIMITS.daily) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      `Daily rate limit exceeded. Limit: ${RATE_LIMITS.daily} requests/day`
    );
  }

  // Add new request timestamp
  requests.push(now);

  // Update Firestore
  await userDoc.set({ requests }, { merge: true });
}

/**
 * Verify user authentication
 */
function requireAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to use this service"
    );
  }
  return context.auth.uid;
}

/**
 * Cloud Functions for authentication and rate limiting
 * Actual AI operations handled by frontend for now
 */
// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = functions.config().gemini?.key || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Gemini API key not configured. Set gemini.key in functions config."
    );
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Generic helper to call Gemini API
 */
async function callGeminiApi(userId: string, modelName: string, prompt: any, config?: any) {
  await checkRateLimit(userId);

  try {
    const client = getGeminiClient();

    // Construct request
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];

    const result = await client.models.generateContent({
      model: modelName,
      contents,
      config
    });

    // Handle null response gracefully
    if (!result) {
      throw new Error("No response from Gemini API");
    }

    return {
      success: true,
      // We return the raw text/candidates for the frontend to parse
      candidates: result.candidates,
      text: result.text,
      promptFeedback: result.promptFeedback
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "An error occurred calling Gemini API"
    );
  }
}

/**
 * Cloud Functions for authentication, rate limiting AND generation
 */
export const generateModelImage = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  const { prompt, model = "gemini-2.5-flash-image", config } = data;

  if (!prompt) {
    throw new functions.https.HttpsError("invalid-argument", "Prompt is required");
  }

  await checkRateLimit(userId);

  try {
    const client = getGeminiClient();

    const parts = [{ text: prompt }];

    const result = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config
    });

    return {
      success: true,
      candidates: result.candidates,
      text: result.text,
      promptFeedback: result.promptFeedback
    };

  } catch (error: any) {
    console.error("Generation Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

export const generateModelFromDescription = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  const { prompt, model, config } = data;
  return callGeminiApi(userId, model || "gemini-2.5-flash-image", prompt, config);
});

export const generateVirtualTryOn = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  const { prompt, model, config, imageParts } = data; // imageParts would be base64

  await checkRateLimit(userId);

  try {
    const client = getGeminiClient();

    // Construct detailed content with images if provided
    const parts: any[] = [{ text: prompt }];

    if (imageParts && Array.isArray(imageParts)) {
      imageParts.forEach(part => {
        if (part.inlineData) {
          parts.push({ inlineData: part.inlineData });
        }
      });
    }

    const result = await client.models.generateContent({
      model: model || "gemini-2.5-flash-image",
      contents: [{ role: 'user', parts }],
      config
    });

    return {
      success: true,
      candidates: result.candidates,
      text: result.text || ""
    };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// Implement other functions similarly using the generic pattern
export const reviseGeneratedImage = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  const { prompt, model, config, imageParts } = data;

  // Reuse the same logic as Virtual TryOn which handles multimodal input
  await checkRateLimit(userId);
  try {
    const client = getGeminiClient();

    const parts: any[] = [{ text: prompt }];
    if (imageParts && Array.isArray(imageParts)) {
      imageParts.forEach(part => {
        if (part.inlineData) {
          parts.push({ inlineData: part.inlineData });
        }
      });
    }

    const result = await client.models.generateContent({
      model: model || "gemini-2.5-flash-image",
      contents: [{ role: 'user', parts }],
      config
    });

    return {
      success: true,
      candidates: result.candidates,
      text: result.text || ""
    };
  } catch (err: any) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});

export const upscaleImage = functions.https.onCall(async (data, context) => {
  // This calls the python backend usually, but if there's a Gemini upscale model:
  const userId = requireAuth(context);
  await checkRateLimit(userId);
  return { success: true, message: "Rate limit check passed" };
});

export const selectivelyEnhanceImage = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  const { prompt, model, config, imageParts } = data;
  await checkRateLimit(userId);
  // Similar proxy implementation
  try {
    const client = getGeminiClient();
    const parts: any[] = [{ text: prompt }];
    if (imageParts && Array.isArray(imageParts)) {
      imageParts.forEach(part => {
        if (part.inlineData) parts.push({ inlineData: part.inlineData });
      });
    }
    const result = await client.models.generateContent({
      model: model || "gemini-2.5-flash-image",
      contents: [{ role: 'user', parts }],
      config
    });
    return { success: true, candidates: result.candidates, text: result.text || undefined };
  } catch (e: any) {
    throw new functions.https.HttpsError('internal', e.message);
  }
});

export const enhancePrompt = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  const { prompt, model, config } = data;
  return callGeminiApi(userId, model || "gemini-2.5-flash-image", prompt, config);
});

export const analyzeGarment = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  const { prompt, model, config, imageParts } = data;
  await checkRateLimit(userId);

  try {
    const client = getGeminiClient();
    const parts: any[] = [{ text: prompt }];
    if (imageParts && Array.isArray(imageParts)) {
      imageParts.forEach(part => {
        if (part.inlineData) parts.push({ inlineData: part.inlineData });
      });
    }
    const result = await client.models.generateContent({
      model: model || "gemini-2.5-flash-image",
      contents: [{ role: 'user', parts }],
      config
    });
    return { success: true, candidates: result.candidates, text: result.text || undefined };
  } catch (e: any) {
    throw new functions.https.HttpsError('internal', e.message);
  }
});

export const generateVideo = functions.https.onCall(async (data, context) => {
  const userId = requireAuth(context);
  // Video generation might be complex (Veo). Assuming text-to-video or image-to-video via generic API
  // Validation needed for production
  await checkRateLimit(userId);
  return { success: true, message: "Video generation proxy not fully implemented yet" };
});

export * from "./upscaleTrigger";

