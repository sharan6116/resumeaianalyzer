import { GoogleGenAI, Type } from "@google/genai";
import { ResumeAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ResumeInput {
  text?: string;
  fileData?: {
    data: string;
    mimeType: string;
  };
}

export async function analyzeResume(input: ResumeInput): Promise<ResumeAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the following resume and provide a structured JSON response.
    1. Predict the best primary job role based on the experience and skills.
    2. Provide 3-4 job recommendations. For each recommendation, include:
       - The job role title.
       - A list of missing skills specific to that role.
       - A match percentage (0-100) based on current resume content.
    3. Calculate an overall resume score out of 100 based on completeness, skill set, and clarity.
    4. Provide a brief professional summary.
    5. Provide specific improvements for the resume.
  `;

  const parts: any[] = [{ text: prompt }];

  if (input.text) {
    parts.push({ text: `Resume Text:\n${input.text}` });
  } else if (input.fileData) {
    parts.push({
      inlineData: {
        data: input.fileData.data,
        mimeType: input.fileData.mimeType,
      },
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          predictedRole: {
            type: Type.STRING,
            description: "The most suitable primary job role",
          },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
                matchPercentage: { type: Type.NUMBER },
              },
              required: ["role", "missingSkills", "matchPercentage"],
            },
            description: "List of recommended job roles with specific missing skills",
          },
          resumeScore: {
            type: Type.NUMBER,
            description: "Overall resume score from 0 to 100",
          },
          summary: {
            type: Type.STRING,
            description: "A brief professional summary",
          },
          improvements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Specific suggestions for improvement",
          },
        },
        required: ["predictedRole", "recommendations", "resumeScore", "summary", "improvements"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Failed to get analysis from AI");
  
  return JSON.parse(text) as ResumeAnalysis;
}
