require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.use(cors({
  origin: ['http://127.0.0.1:3000', 'http://localhost:3000']
}));

app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'AmanFi AI Backend',
    aiConfigured: Boolean(API_KEY)
  });
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'Please enter a message.'
    });
  }

  if (message.length > 2000) {
    return res.status(400).json({
      error: 'Message is too long.'
    });
  }

  if (!API_KEY) {
    return res.status(500).json({
      error: 'Gemini API key is missing.'
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'You are AmanFi AI, a helpful personal finance assistant. Support English and Afaan Oromoo. Never ask for bank PINs, passwords, or OTPs. Do not claim to know a user’s balance or transactions unless the user provides that information.'
            }]
          },
          contents: [{
            role: 'user',
            parts: [{ text: message.trim() }]
          }],
          generationConfig: {
            maxOutputTokens: 700
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        'Gemini API error:',
        response.status,
        JSON.stringify(data)
      );

      return res.status(502).json({
        error: 'Gemini request failed. Check API key, model access, or quota.'
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: 'Gemini returned no text.'
      });
    }

    return res.json({ reply });

  } catch (error) {
    console.error('Gemini connection error:', error.message);

    return res.status(502).json({
      error: 'Could not connect to Gemini. Check your internet connection.'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AmanFi backend running at http://127.0.0.1:${PORT}`);
});
