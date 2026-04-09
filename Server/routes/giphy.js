import express from 'express';

const router = express.Router();
const GIPHY_KEY = process.env.GIPHY_API_KEY || '';
const LIMIT = 24;
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';

function mapGifs(data) {
  return (data || []).map((g) => ({
    id: g.id,
    title: g.title || '',
    url: g.images?.original?.url || '',
    preview: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url || '',
    width: Number(g.images?.fixed_width?.width) || 200,
    height: Number(g.images?.fixed_width?.height) || 200,
    mp4: g.images?.fixed_width?.mp4 || '',
  }));
}

router.get('/trending', async (req, res) => {
  if (!GIPHY_KEY) return res.status(503).json({ error: 'Giphy API key not configured' });

  try {
    const url = `${GIPHY_BASE}/trending?api_key=${GIPHY_KEY}&limit=${LIMIT}&rating=g`;
    const resp = await fetch(url);
    if (!resp.ok) return res.status(resp.status).json({ error: 'Giphy API error' });
    const json = await resp.json();
    res.json({ gifs: mapGifs(json.data) });
  } catch (err) {
    console.error('[Giphy] trending error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search', async (req, res) => {
  if (!GIPHY_KEY) return res.status(503).json({ error: 'Giphy API key not configured' });

  const q = (req.query.q || '').trim();
  if (!q) return res.json({ gifs: [] });

  try {
    const url = `${GIPHY_BASE}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=${LIMIT}&rating=g`;
    const resp = await fetch(url);
    if (!resp.ok) return res.status(resp.status).json({ error: 'Giphy API error' });
    const json = await resp.json();
    res.json({ gifs: mapGifs(json.data) });
  } catch (err) {
    console.error('[Giphy] search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
