import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { gradesApi, attemptsApi } from '../hooks/quizzes';

export default function GradesPage() {
  const { token, user } = useAuth();
  const api = useMemo(() => gradesApi(token), [token]);
  const aapi = useMemo(() => attemptsApi(token), [token]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await api.list();
        if (!mounted) return;
        setRows(data || []);
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load grades');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [api]);

  async function removeAttempt(id) {
    if (!id) return;
    if (!window.confirm('Remove this grade record? This deletes the attempt.')) return;
    try {
      await aapi.remove(id);
      setRows(prev => prev.filter(r => String(r.attempt_id) !== String(id)));
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Record removed' } })); } catch(_) {}
    } catch (e) {
      alert(e.message || 'Failed to remove');
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Grades</h2>
      {error && <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Quiz</th>
              {user?.role === 'teacher' && <th style={{ padding: 8 }}>Student</th>}
              <th style={{ padding: 8 }}>Score</th>
              <th style={{ padding: 8 }}>Percent</th>
              <th style={{ padding: 8 }}>Date</th>
              {user?.role === 'teacher' && <th style={{ padding: 8 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.total_items ? Math.round((r.score / r.total_items) * 100) : 0;
              return (
                <tr key={r.attempt_id}>
                  <td style={{ padding: 8 }}>{r.title}{r.course_name ? ` — ${r.course_name}` : ''}</td>
                  {user?.role === 'teacher' && <td style={{ padding: 8 }}>{r.student_name}</td>}
                  <td style={{ padding: 8 }}>{r.score}/{r.total_items}</td>
                  <td style={{ padding: 8 }}>{pct}%</td>
                  <td style={{ padding: 8 }}>{new Date(r.created_at).toLocaleString()}</td>
                  {user?.role === 'teacher' && (
                    <td style={{ padding: 8 }}>
                      <button
                        onClick={() => removeAttempt(r.attempt_id)}
                        className="qd-btn-anim"
                        style={{ padding:'8px 12px', borderRadius:10, border:'2px solid #dd2680', background:'#dd2680', color:'#fff', fontWeight:900, fontFamily:'Kodchasan, system-ui', cursor:'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#dd2680'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#dd2680'; e.currentTarget.style.color = '#fff'; }}
                      >Remove</button>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td style={{ padding: 8 }} colSpan={user?.role === 'teacher' ? 6 : 5}>No grades yet.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
