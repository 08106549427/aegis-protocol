// ─────────────────────────────────────────────
// AEGIS — Vercel Serverless Function
// Uses Google Gemini API (free tier)
// ─────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { taskId, title, category, brief, submission } = req.body;

    if (!brief) return res.status(400).json({ error: 'Brief is required' });

    const prompt = `You are Aegis, the quality control layer for 0xWork — a decentralized task marketplace on Base chain.

Review this task and respond ONLY with valid JSON, no other text:

TASK: ${title || 'Task #' + taskId}
CATEGORY: ${category}
BRIEF: ${brief}
SUBMISSION: ${submission || 'No submission yet — this is an open task. Score the brief quality and provide guidance on what a strong submission should include.'}

Respond ONLY with this exact JSON:
{
  "completeness": <1-10>,
  "accuracy": <1-10>,
  "quality": <1-10>,
  "alignment": <1-10>,
  "overall": <1-10>,
  "recommendation": "<APPROVE|REVISE|REJECT>",
  "summary": "<2-3 sentence clear description of the review verdict and reasoning>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "issues": ["<specific issue 1>", "<specific issue 2>"]
}

Scoring: APPROVE >= 7, REVISE 5-6, REJECT < 5. Be specific and actionable.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.status(500).json({ error: `Gemini API error: ${error}` });
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const review = JSON.parse(clean);

    return res.status(200).json(review);

  } catch (error) {
    console.error('Review error:', error);
    return res.status(500).json({ error: error.message });
  }
}
