import React, { useEffect, useState } from 'react';

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // Normalization helpers and centralized legacy -> friendly upgrades
  const normalize = (s) => (s || '').toString().trim().replace(/[.!\s]+$/,'').toLowerCase();
  const capFirst = (s) => {
    const str = (s || '').toString();
    if (!str) return '';
    const i = str.search(/[A-Za-z]/);
    if (i < 0) return str;
    return str.slice(0, i) + str.charAt(i).toUpperCase() + str.slice(i + 1);
  };
  const FRIENDLY = new Map([
    // Friends
    [normalize('Friend request accepted'), 'Friend request accepted — you’re connected! 🎉'],
    [normalize('Friend request rejected'), 'Request declined. All good!'],
    [normalize('Friend request sent'), 'Request sent! Fingers crossed. 🤝'],
    [normalize('Failed to accept'), 'Couldn’t accept — please try again.'],
    [normalize('Failed to accept request'), 'Couldn’t accept — please try again.'],
    [normalize('Failed to reject'), 'Couldn’t decline that — please try again.'],
    [normalize('Failed to reject request'), 'Couldn’t decline that — please try again.'],
    [normalize('Failed to remove'), 'Unable to remove that — please try again.'],
    [normalize('Failed to remove friend'), 'Unable to remove this friend right now — try again.'],
    [normalize('Failed to send request'), 'Unable tosend the request — check your connection and try again.'],
    // Profile
    [normalize('Only PNG or JPG images are allowed'), 'Please upload a PNG or JPG image.'],
    [normalize('Profile picture updated successfully'), 'New profile picture — looking great! ✨'],
    [normalize('Upload failed'), 'Upload didn’t go through — try again in a moment.'],
    [normalize('Profile updated'), 'Profile saved — nice and tidy! ✅'],
    // Courses
    [normalize('The course is private. Join it first'), 'No peeking! This course is private.'],
    [normalize('Joined course'), 'You’re in! 🎉'],
    [normalize('Joined'), 'You’re in! 🎉'],
    [normalize('Already enrolled'), 'You’re already in this course, silly!'],
    [normalize('Left course'), 'You’ve left the course. Hope to see you back soon!'],
    [normalize('Course updated successfully'), 'Course updated — looking good! ✅'],
    [normalize('Course updated'), 'Course updated — looking good! ✅'],
    [normalize('Course deleted successfully'), 'Course deleted. Farewell!'],
    // Announcements
    [normalize('Announcement posted'), 'Announcement posted — students will see it shortly! 📣'],
    [normalize('Announcement updated'), 'Announcement updated. ✅'],
    [normalize('Please enter a title and message'), 'Please add a title and a message before posting. 📝'],
  ]);

  function rewriteMessage(msg) {
    if (!msg) return '';
    const norm = normalize(msg);
    if (FRIENDLY.has(norm)) return FRIENDLY.get(norm);
    // Generic upgrades
    if (/^Failed to\s+(.+)/i.test(norm)) {
      const action = norm.replace(/^Failed to\s+/i, '').replace(/\.$/, '');
      return `Couldn’t ${action.toLowerCase()} — please try again.`;
    }
    if (/^Could not\s+(.+)/i.test(norm)) {
      const what = norm.replace(/^Could not\s+/i, '').replace(/\.$/, '');
      return `Couldn’t ${what.toLowerCase()} — try again in a moment.`;
    }
    if (/Unauthorized/i.test(norm)) return 'You don’t have permission to do that.';
    if (/Not found/i.test(norm)) return 'We couldn’t find that item.';
    if (/successfully/i.test(norm)) return norm.replace(/successfully/i, '— nicely done! ✅');
    return norm;
  }

  useEffect(() => {
    function onToast(e) {
      const d = e.detail || {};
      const id = Math.random().toString(36).slice(2);
      const legacy = (d.message || '').toString();
      const friendly = rewriteMessage(legacy);
      const toast = {
        id,
        type: d.type || 'info',
        title: capFirst(d.title || ''),
        message: capFirst(friendly),
        duration: Math.max(1500, Math.min(8000, d.duration || 2800))
      };
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, toast.duration);
    }
    window.addEventListener('toast', onToast);
    return () => window.removeEventListener('toast', onToast);
  }, []);

  const palette = {
    success: { bg: 'linear-gradient(135deg,#e8f9f1,#f4fff9)', fg: '#0f9d58', chip:'#c9f0dc' },
    info:    { bg: 'linear-gradient(135deg,#eef7ff,#fafcff)', fg: '#1a73e8', chip:'#d7e9ff' },
    warning: { bg: 'linear-gradient(135deg,#fff5e6,#fffaf2)', fg: '#b26a00', chip:'#ffe4b8' },
    error:   { bg: 'linear-gradient(135deg,#fdecec,#fff8f8)', fg: '#d93025', chip:'#ffd1cc' },
    default: { bg: 'linear-gradient(135deg,#f7f3ff,#ffffff)', fg: '#6a3ecb', chip:'#e7dcff' }
  };

  const iconFor = (type) => {
    switch(type){
      case 'success': return '🎉';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return '💡';
      default: return '✨';
    }
  };

  return (
    <>
      {children}
      <style>{`
        @keyframes toastIn { 0%{ transform: translateY(-8px) scale(.96); opacity:.0 } 60%{ transform: translateY(0) scale(1.02); opacity:.95 } 100%{ transform: translateY(0) scale(1); opacity:1 } }
      `}</style>
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toasts.map(t => {
          const theme = palette[t.type] || palette.default;
          return (
            <div key={t.id} role="status" aria-live="polite"
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 16,
                color: theme.fg,
                background: theme.bg,
                border: '1px solid rgba(106,62,203,0.08)',
                boxShadow: '0 10px 22px rgba(106,62,203,0.18)',
                minWidth: 260,
                maxWidth: 380,
                fontFamily: 'Kodchasan, system-ui',
                animation: 'toastIn .26s ease-out',
              }}>
              <div style={{ fontSize: 18 }}>{iconFor(t.type)}</div>
              <div>
                {t.title ? <div style={{ fontWeight: 900, marginBottom: 2 }}>{t.title}</div> : null}
                <div style={{ fontWeight: 700 }}>{t.message}</div>
              </div>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                aria-label="Dismiss"
                style={{ border:'none', background:'transparent', color: theme.fg, fontWeight: 900, cursor:'pointer', opacity:.7 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '.7'}>
                ×
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
