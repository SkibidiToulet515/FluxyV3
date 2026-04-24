import { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2, Search, Trash2, Edit3, Plus, Loader2,
  Eye, EyeOff, Star,
} from 'lucide-react';
import {
  getAllGameDocs, createGameDoc, updateGameDoc, deleteGameDoc,
} from '../../services/firestore';
import GameForm from './GameForm';

export default function GameManagement() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAllGameDocs();
    setGames(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    await deleteGameDoc(id);
    setDeleteConfirm(null);
    load();
  }

  const filtered = games.filter((g) =>
    g.title?.toLowerCase().includes(search.toLowerCase()) ||
    g.category?.toLowerCase().includes(search.toLowerCase()) ||
    (g.subject && g.subject.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <section className="admin-section glass-card">
      <div className="admin-section-header">
        <Gamepad2 size={20} />
        <div>
          <h3>Game Management</h3>
          <p>{games.length} games in database</p>
        </div>
        <button className="admin-btn admin-btn-primary admin-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setCreating(true)}>
          <Plus size={14} /> Add Game
        </button>
      </div>

      <div className="admin-search">
        <Search size={14} />
        <input placeholder="Search games..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {creating && (
        <GameForm
          onSave={async (data, gameFile) => {
            await createGameDoc(data, gameFile || null);
            setCreating(false);
            load();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {editing && (
        <GameForm
          initial={editing}
          onSave={async (data, gameFile) => {
            await updateGameDoc(editing.id, data, gameFile || null);
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading games...</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Title</th><th>Category</th><th>Subject</th><th>Plays</th><th>Visible</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td>
                    <div className="admin-game-cell">
                      {g.thumbnail && <img src={g.thumbnail} alt="" className="admin-game-thumb" />}
                      <div>
                        <span className="admin-game-title">{g.title || g.id}</span>
                        {g.featured && <Star size={11} className="admin-featured-star" />}
                      </div>
                    </div>
                  </td>
                  <td><span className="admin-category-pill">{g.category || 'Uncategorized'}</span></td>
                  <td><span className="admin-category-pill">{g.subject || '—'}</span></td>
                  <td className="admin-muted">{g.plays ?? 0}</td>
                  <td>{g.visible !== false ? <Eye size={14} className="admin-visible" /> : <EyeOff size={14} className="admin-hidden" />}</td>
                  <td>
                    <div className="admin-actions-row">
                      <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setEditing(g)} title="Edit">
                        <Edit3 size={13} />
                      </button>
                      {deleteConfirm === g.id ? (
                        <>
                          <button className="admin-btn admin-btn-danger admin-btn-xs" onClick={() => handleDelete(g.id)}>Delete</button>
                          <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                        </>
                      ) : (
                        <button className="admin-btn admin-btn-danger admin-btn-xs" onClick={() => setDeleteConfirm(g.id)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="admin-empty">No games found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
