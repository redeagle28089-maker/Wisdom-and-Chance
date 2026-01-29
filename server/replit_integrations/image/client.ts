import { GoogleGenAI, Modality } from "@google/genai";

// This is using Replit's AI Integrations service, which provides Gemini-compatible API access without requiring your own Gemini API key.
export const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

/**
 * Generate text content using Gemini Flash model.
 * Uses gemini-2.5-flash via Replit AI Integrations.
 */
export async function generateText(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const candidate = response.candidates?.[0];
  const textPart = candidate?.content?.parts?.find(
    (part: { text?: string }) => part.text
  );

  if (!textPart?.text) {
    throw new Error("No text in response");
  }

  return textPart.text;
}

/**
 * Generate an image and return as base64 data URL.
 * Uses gemini-2.5-flash-image model via Replit AI Integrations.
 * @param prompt - Text prompt describing the image to generate
 * @param referenceImageBase64 - Optional reference image as data URL to influence style
 */
export async function generateImage(prompt: string, referenceImageBase64?: string): Promise<string> {
  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
  
  // If reference image is provided, include it in the request
  if (referenceImageBase64) {
    // Extract base64 data and mime type from data URL
    const match = referenceImageBase64.match(/^data:(.+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const data = match[2];
      parts.push({
        inlineData: { data, mimeType }
      });
      parts.push({
        text: `Use this reference image as style inspiration. ${prompt}`
      });
    } else {
      parts.push({ text: prompt });
    }
  } else {
    parts.push({ text: prompt });
  }
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image data in response");
  }

  const mimeType = imagePart.inlineData.mimeType || "image/png";
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

