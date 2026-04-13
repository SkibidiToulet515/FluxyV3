import { Router } from 'express';
import { verifyToken } from '../config/firebase.js';

const router = Router();

const rateMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRate(uid) {
  const now = Date.now();
  const entry = rateMap.get(uid);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(uid, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

router.post('/', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Gemini API key not configured' });

  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) return res.status(401).json({ error: 'Not authenticated' });

  let uid;
  try {
    const decoded = await verifyToken(auth);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!checkRate(uid)) return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const contents = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text || m.content || '' }],
  }));

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Gemini] API error:', response.status, err);
      return res.status(response.status).json({ error: 'Gemini API error' });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
  } catch (err) {
    console.error('[Gemini] Request failed:', err.message);
    res.status(500).json({ error: 'Failed to reach Gemini API' });
  }
});

export default router;
