// ─────────────────────────────────────────────
// AEGIS — Vercel Serverless Function
// Uses OpenRouter API (free tier)
// ─────────────────────────────────────────────

export default async function handler(req, res) {
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
SUBMISSION: ${submission || 'No submission yet — open task. Score brief quality and provide guidance on what a strong submission should include.'}

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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://aegis-protocol-two.vercel.app',
        'X-Title': 'Aegis Quality Control',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(500).json({ error: `OpenRouter API error: ${error}` });
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    const review = JSON.parse(clean);

    return res.status(200).json(review);

  } catch (error) {
    console.error('Review error:', error);
    return res.status(500).json({ error: error.message });
  }
}
