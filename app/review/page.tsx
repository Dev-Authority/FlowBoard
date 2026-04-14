'use client';
import { useState, useEffect } from 'react';
import { DailyReview } from '@/lib/types';

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReviewPage() {
  const [reviews, setReviews]       = useState<DailyReview[]>([]);
  const [loading, setLoading]       = useState(true);
  const [whatGotDone, setWhatGotDone]   = useState('');
  const [whatStoppedMe, setWhatStoppedMe] = useState('');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [search, setSearch]         = useState('');
  const today = getTodayString();

  const fetchReviews = async () => {
    const r = await fetch('/api/reviews');
    const data = await r.json();
    setReviews(data);
    setLoading(false);
    const todayReview = data.find((rv: DailyReview) => rv.date === today);
    if (todayReview) { setWhatGotDone(todayReview.whatGotDone); setWhatStoppedMe(todayReview.whatStoppedMe); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchReviews(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatGotDone.trim() || !whatStoppedMe.trim()) return;
    setSaving(true);
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, whatGotDone, whatStoppedMe }),
    });
    if (res.ok) { setSaved(true); fetchReviews(); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  const filtered = reviews.filter(
    (r) => r.whatGotDone.toLowerCase().includes(search.toLowerCase()) ||
           r.whatStoppedMe.toLowerCase().includes(search.toLowerCase()) ||
           r.date.includes(search)
  );

  const taStyle = {
    background: 'var(--color-raised)',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-line)',
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-canvas)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">

        <div className="mb-6">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-ink)' }}>End of Day Review</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>2 minutes. Be honest with yourself.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}
              className="rounded-xl p-4 mb-8 space-y-4"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                   style={{ color: '#10b981' }}>
              What did you actually get done?
            </label>
            <textarea
              value={whatGotDone}
              onChange={(e) => setWhatGotDone(e.target.value)}
              rows={4}
              placeholder="List the wins, even the small ones..."
              className="w-full text-sm rounded-lg px-3 py-2.5 outline-none resize-none"
              style={taStyle}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                   style={{ color: '#ef4444' }}>
              What stopped or slowed you down?
            </label>
            <textarea
              value={whatStoppedMe}
              onChange={(e) => setWhatStoppedMe(e.target.value)}
              rows={4}
              placeholder="Be specific. What was the friction? Distraction? Fear? Laziness?"
              className="w-full text-sm rounded-lg px-3 py-2.5 outline-none resize-none"
              style={taStyle}
            />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
              className="text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save review'}
            </button>
            {saved && (
              <span className="text-sm" style={{ color: '#34d399' }}>
                ✓ Saved for {today}
              </span>
            )}
          </div>
        </form>

        {/* Past reviews */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest"
                style={{ color: 'var(--color-muted)' }}>Past Reviews</h2>
            <input
              type="text" placeholder="Search…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm rounded-lg px-3 py-1.5 outline-none w-36"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-ink)',
                border: '1px solid var(--color-line)',
              }}
            />
          </div>

          {loading ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--color-muted)' }}>No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((rv) => (
                <div key={rv._id}
                  className="rounded-xl p-4"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
                  <p className="text-[11px] font-mono mb-3" style={{ color: 'var(--color-muted)' }}>{rv.date}</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
                         style={{ color: '#10b981' }}>Got done</p>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-ink)' }}>
                        {rv.whatGotDone}
                      </p>
                    </div>
                    <div className="h-px" style={{ background: 'var(--color-line)' }} />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
                         style={{ color: '#ef4444' }}>Slowed me down</p>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-muted)' }}>
                        {rv.whatStoppedMe}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
