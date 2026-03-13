import FormData from "form-data";
import fs from "fs";
import fetch from "node-fetch";
import logger from "../utils/logger.js";

export const transcribeAudio = async (filePath, mimeType = "audio/webm") => {

  if (!process.env.OPENAI_API_KEY) {
    logger.warn("[Transcription] OPENAI_API_KEY not set — using mock transcript");
    return "This is a mock transcription for development. The audio has been processed successfully.";
  }

  try {

    const form = new FormData();

    form.append("file", fs.createReadStream(filePath), {
      contentType: mimeType,
      filename: "audio.webm",
    });

    // Groq Whisper model
    form.append("model", "whisper-large-v3");
    form.append("response_format", "json");

    const response = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
        body: form,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq Whisper API ${response.status}: ${errText}`);
    }

    const data = await response.json();

    logger.info("[Transcription] Audio transcribed successfully");

    return data.text;

  } catch (error) {

    logger.error(`[Transcription] Failed: ${error.message}`);

    throw new Error(
      "Transcription service unavailable. Please try again later."
    );

  }
};