import { GoogleGenerativeAI } from "@google/generative-ai";

export async function getOrganizationPlan(file: any, apiKey: string) {
  // Use the provided key or fall back to the environment variable
  const activeApiKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
  if (!activeApiKey) throw new Error("Missing Gemini API Key");

  const genAI = new GoogleGenerativeAI(activeApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

  const prompt = `
    Analyze this file metadata:
    Name: ${file.name}
    MimeType: ${file.mimeType}
    CreatedTime: ${file.createdTime}

    Task:
    Suggest a professional, SEO-friendly, and organized name for this file. 
    Also suggest a logical parent folder name (e.g., 'Events', 'SocialMedia', 'Documentation', 'Workshops').
    
    Return ONLY a JSON object:
    {
      "suggestedName": "YYYY-MM-DD_Brief-Description.ext",
      "targetFolder": "FolderName"
    }
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  try {
    // Clean potential markdown code blocks
    const jsonStr = text.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(jsonStr);
    
    // Return plan plus usage stats
    return {
      ...plan,
      usage: response.usageMetadata
    };
  } catch (e: any) {
    console.error("Failed to parse Gemini response", text, e);
    return {
      suggestedName: file.name,
      targetFolder: "Unsorted",
      usage: response.usageMetadata
    };
  }
}
