import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export const generateAdvice = async (transcript, moodLabel) => {

  try {

    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are a supportive emotional wellness coach."
        },
        {
          role: "user",
          content: `Mood: ${moodLabel}\nJournal: ${transcript}\nGive 1 or 2 coping strategies under 80 words.`
        }
      ],
    });

    return completion.choices[0].message.content;

  } catch (error) {
    console.error(error);
    return null;
  }

};