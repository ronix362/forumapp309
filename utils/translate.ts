// Code source: ChatGPT
const HF_TRANSLATE_API =
  // "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-mul-en";
  "https://router.huggingface.co/hf-inference/models/Helsinki-NLP/opus-mt-mul-en";

interface TranslationResponse {
  translation_text: string;
}

/**
 * Translates multi-language text to English using Helsinki-NLP model
 * Optimized for Vercel Edge/Serverless functions
 */
export async function translateToEnglish(text: string): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing HUGGINGFACE_API_KEY environment variable");
  }

  try {
    const res = await fetch(HF_TRANSLATE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
        // Wait for model to load if it's idle
        options: { wait_for_model: true } 
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("HF Translation Error:", errorData);
      throw new Error(errorData.error || "Translation request failed");
    }

    const data = (await res.json()) as TranslationResponse[];

    if (!data || data.length === 0 || !data[0].translation_text) {
      throw new Error("Invalid response format from Translation API");
    }

    return data[0].translation_text;
  } catch (error) {
    console.error("Translation utility failed:", error);
    // Return original text as fallback so the UI doesn't break
    return text;
  }
}