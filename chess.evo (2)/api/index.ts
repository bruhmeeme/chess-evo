import express from "express";

const app = express();
app.use(express.json());

app.post("/api/analyze", async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY environment variable is missing." });
    }

    const { fen, moveNotation, badgeName, topMoves, playerElo, prompt } = req.body;

    let sysInst = `You are a direct, declarative, and elite Chess Grandmaster commentator.
Your singular job is to evaluate a specific move based on Stockfish engine analysis and output an incredibly short, concise explanation.

STRICTLY FORBIDDEN:
- Do NOT hallucinate tactics, board state, or guess piece positions. You must treat the "Concrete Tactical Facts" provided as the absolute, unquestionable truth. Never contradict them.
- Do not use a Socratic teaching style. Never ask questions like "What did you miss?".
- Do not use introductory fluff like "Looking at the board..." or "In this position...". Get straight to the point.
- The commentary MUST be under 35 words.

MANDATE: Give direct, insightful analysis in plain English strictly evaluating the user's move choice using ONLY the provided Concrete Tactical Facts and evaluation data.`;

    if (playerElo < 1000) {
      sysInst += `\n\nThe player's ELO is under 1000 (${playerElo}). Explain things purely via material safety, hanging pieces, and 1-step blunders.`;
    } else if (playerElo < 1500) {
      sysInst += `\n\nThe player's ELO is intermediate (${playerElo}). Focus on tactics, open lines, king safety, and basic pawn structures.`;
    } else {
      sysInst += `\n\nThe player's ELO is advanced (${playerElo}). Skip basic rules entirely. Use advanced concepts like outposts, prophylaxis, weak color complexes, and piece coordination.`;
    }

    let textResponse = "";
    try {
      const fetchResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: sysInst
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
        })
      });

      if (!fetchResponse.ok) {
         const errorData = await fetchResponse.json().catch(() => ({}));
         throw new Error(`Groq API error: ${fetchResponse.status} ${fetchResponse.statusText} - ${JSON.stringify(errorData)}`);
      }

      const data = await fetchResponse.json();
      textResponse = data.choices?.[0]?.message?.content || "";
    } catch (err: any) {
      throw err;
    }

    res.json({ text: textResponse });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || "An error occurred" });
  }
});

export default app;
