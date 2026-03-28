import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ProfilePictureOptions {
  style: string;
  background: string;
  description?: string;
}

export async function generateProfilePicture(options: ProfilePictureOptions): Promise<string> {
  const model = 'gemini-2.5-flash-image';
  
  const prompt = `
    Generate a professional, high-quality profile picture for a LinkedIn or corporate profile.
    Style: ${options.style}
    Background: ${options.background}
    ${options.description ? `Additional description: ${options.description}` : ''}
    The image should be a clear, front-facing headshot of a professional person. 
    Ensure the lighting is professional and the composition is standard for a profile photo.
    The person should look confident and approachable.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  let imageUrl = "";
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      imageUrl = `data:image/png;base64,${base64EncodeString}`;
      break;
    }
  }

  if (!imageUrl) {
    throw new Error("Failed to generate image. Please try again.");
  }

  return imageUrl;
}
