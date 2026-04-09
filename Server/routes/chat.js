import express from 'express';

/** @type {Array<{ user: string, text: string, ts: number }>} */
export const recentMessages = [];

const router = express.Router();

router.get('/history', (req, res) => {
  res.json(recentMessages);
});

export default router;
