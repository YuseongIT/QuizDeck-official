import React, { useEffect, useMemo, useRef, useState } from 'react';
import { quizzesApi, attemptsApi, gradesApi } from '../../hooks/quizzes';
import { API_BASE } from '../../api';

export default function TakeQuizModal({ token, quizId, onClose }) {
  const qapi = useMemo(() => quizzesApi(token), [token]);
  const aapi = useMemo(() => attemptsApi(token), [token]);
  const gapi = useMemo(() => gradesApi(token), [token]);
  const [quiz, setQuiz] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [stage, setStage] = useState('info'); // info|taking|paused|result
  const [saving, setSaving] = useState(false);
  const [score, setScore] = useState(null);
  const [resultMap, setResultMap] = useState({}); // { [itemId]: { is_correct: boolean|null, selected: any } }
  const [ringPct, setRingPct] = useState(0);
  const timerRef = useRef(null);
  const key = `quiz_in_progress_${quizId}`;
  const [alreadyTaken, setAlreadyTaken] = useState(false);
  const [responsesCount, setResponsesCount] = useState(0);
  const apiBase = API_BASE;
  const assetBase = (process.env.REACT_APP_ASSET_BASE || '').replace(/\/$/, '');
  const toAbs = (p) => {
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) {
      if (assetBase) {
        try {
          const u = new URL(p);
          const path = u.pathname.replace(/^\//,'');
          if (/^(quiz_images|quiz_media)\//i.test(path) || /\/(quiz_images|quiz_media)\//i.test(path)) {
            return `${assetBase}/${path}`;
          }
        } catch(_){}
      }
      return p;
    }
    const clean = p.startsWith('/') ? p.slice(1) : p;
    if (assetBase && (/^(quiz_images|quiz_media)\//i.test(clean) || /^storage\/(quiz_images|quiz_media)\//i.test(clean))) {
      return `${assetBase}/${clean}`;
    }
    return `${apiBase}${p.startsWith('/') ? p : `/${p}`}`;
  };
  const [shuffles, setShuffles] = useState({}); // { [itemId]: shuffled array }
  const [currentIdx, setCurrentIdx] = useState(0);
  const navMode = (typeof window !== 'undefined' ? (localStorage.getItem(`quiz_nav_mode_${quizId}`) || 'both') : 'both');
  const forwardOnly = navMode === 'forward';
  const [imgH, setImgH] = useState(200);
  const [fullImg, setFullImg] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const shuffle = (arr) => {
    const a = Array.isArray(arr) ? [...arr] : [];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const fetchedRef = useRef({ id: null });
  useEffect(() => {
    let mounted = true;
    async function load() {
      try { const q = await qapi.get(quizId); if (mounted) setQuiz(q); } catch (_) {}
      try {
        const rows = await gapi.list();
        if (mounted) {
          const filtered = Array.isArray(rows) ? rows.filter(r => Number(r.quiz_id) === Number(quizId)) : [];
          setAlreadyTaken(filtered.length > 0);
          setResponsesCount(filtered.length);
        }
      } catch(_) {}
      // resume from localStorage
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          if (data?.answers) setAnswers(data.answers);
          if (data?.shuffles) setShuffles(data.shuffles);
          setStage('paused');
        }
      } catch(_) {}
    }
    if (fetchedRef.current.id !== quizId) {
      fetchedRef.current.id = quizId;
      load();
    }
    const onBeforeUnload = (e) => {
      if (stage === 'taking') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => { mounted = false; stopAutosave(); window.removeEventListener('beforeunload', onBeforeUnload); };
  }, [quizId, qapi, gapi, stage]);

  // Reset adjustable image height when navigating between items
  useEffect(() => { setImgH(200); }, [currentIdx]);

  function startAutosave(attemptId) {
    stopAutosave();
    timerRef.current = setInterval(async () => {
      try {
        setSaving(true);
        const now = Date.now();
        localStorage.setItem(key, JSON.stringify({ attemptId, answers, shuffles, t: now }));
        localStorage.setItem('quiz_autosave_time', String(now));
        await aapi.autosave(attemptId, { answers });
      } catch (_) { /* ignore */ }
      finally { setSaving(false); }
    }, 10000);
  }
  function stopAutosave() { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }

  async function onStart() {
    try {
      if (alreadyTaken && quiz && !quiz.is_repeatable) {
        try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: "You've already taken this quiz!" } })); } catch(_) {}
        return;
      }
      const a = await aapi.start(quizId);
      setAttempt(a);
      setStage('taking');
      // initialize shuffles and initial ordering answers if missing
      if (quiz && (!shuffles || Object.keys(shuffles).length === 0)) {
        const s = {};
        (quiz.items || []).forEach(it => {
          const type = String(it.type||'').toLowerCase();
          if (type === 'ordering') {
            s[it.id] = shuffle(it.meta?.order || []);
          }
        });
        setShuffles(s);
        setAnswers(prev => {
          const next = { ...prev };
          (quiz.items || []).forEach(it => {
            const type = String(it.type||'').toLowerCase();
            if (type === 'ordering') {
              if (!Array.isArray(next[it.id]) || next[it.id].length === 0) {
                next[it.id] = (s[it.id] || []);
              }
            }
          });
          try {
            const now = Date.now();
            localStorage.setItem(key, JSON.stringify({ attemptId: a.id, answers: next, shuffles: s, t: now }));
          } catch(_) {}
          return next;
        });
      }
      startAutosave(a.id);
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Quiz started' } })); } catch(_) {}
    } catch (e) {
      const msg = (e && e.message) || '';
      if (msg.toLowerCase().includes('not repeatable')) {
        try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: "You've already taken this quiz!" } })); } catch(_) {}
      } else {
        alert(e.message || 'Failed to start');
      }
    }
  }

  async function onSubmit() {
    if (!attempt) return;
    try {
      stopAutosave();
      // Normalize answers to match backend expectations
      const payloadAnswers = (() => {
        const out = { ...answers };
        try {
          (quiz.items || []).forEach(it => {
            const type = String(it.type||'').toLowerCase();
            // true_false questions: backend expects choice IDs, but UI stores 'True'/'False'. Map to the matching choice id.
            if (type === 'true_false') {
              const val = out[it.id];
              const choices = Array.isArray(it.choices) ? it.choices : [];
              if (typeof val === 'string') {
                const target = val.trim().toLowerCase();
                const match = choices.find(c => String((c.choice_text ?? c.label ?? '')).trim().toLowerCase() === target);
                if (match && match.id != null) {
                  out[it.id] = match.id;
                }
              }
            }
            if (type === 'ordering' && Array.isArray(out[it.id]) && Array.isArray(it?.meta?.order)) {
              const originals = (it.meta.order || []).map(s => (s ?? '').toString());
              const normMap = new Map();
              originals.forEach(orig => normMap.set(orig.trim().toLowerCase(), orig));
              const current = out[it.id].map(s => (s ?? '').toString());
              // Replace each current entry with the exact original token if a trim/lowercase match exists
              const replaced = current.map(s => normMap.get(s.trim().toLowerCase()) || s);
              out[it.id] = replaced;
              // Also submit indices companion in case backend expects positions
              const indices = replaced.map(val => originals.indexOf(val));
              out[`${it.id}_indices`] = indices;
            }
          });
        } catch(_) {}
        return out;
      })();
      const res = await aapi.submit(attempt.id, payloadAnswers);
      setScore({ score: res.score, total: res.total_items });
      try {
        const map = {};
        (res.responses || []).forEach(r => {
          let sel = r?.selected_answer;
          try {
            // Attempt to parse array/object JSON stored by backend
            if (typeof sel === 'string' && (sel.startsWith('[') || sel.startsWith('{'))) sel = JSON.parse(sel);
          } catch(_) {}
          map[r.item_id] = { is_correct: r?.is_correct ?? null, selected: sel };
        });
        setResultMap(map);
      } catch(_) { setResultMap({}); }
      setRingPct(0); // reset ring so animation starts from 0 on every result open
      setStage('result');
      localStorage.removeItem(key);
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Quiz submitted' } })); } catch(_) {}
    } catch (e) { alert(e.message || 'Failed to submit'); startAutosave(attempt.id); }
  }

  function setAnswer(itemId, value) {
    setAnswers(prev => ({ ...prev, [itemId]: value }));
  }

  if (!quiz) return null;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', backdropFilter:'blur(2px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, animation:'fadeIn .18s ease-out' }}>
      <style>{`@keyframes popIn {0%{transform:scale(.96);opacity:.0} 70%{transform:scale(1.02);opacity:.98} 100%{transform:scale(1);opacity:1}} @keyframes fadeIn {from{opacity:0} to{opacity:1}}`}</style>
      <div style={{ width:'min(900px, 96vw)', maxHeight:'90vh', overflow:'auto', background:'#fff', borderRadius:16, padding:24, boxShadow:'0 14px 36px rgba(0,0,0,0.2)', animation:'popIn .18s ease-out', fontFamily:'Kodchasan, system-ui, sans-serif' }}>
        <div style={{ background:'#dd2680', padding:8, margin:'-24px -24px 18px', borderTopLeftRadius:16, borderTopRightRadius:16, display:'flex', justifyContent:'flex-end', alignItems:'center' }}>
          <button onClick={() => { stopAutosave(); onClose(); }} title="Close"
            style={{ width:44, height:44, borderRadius:12, border:'1px solid rgba(255,255,255,0.6)', background:'transparent', color:'#fff', fontWeight:900, fontSize:28, lineHeight:'28px', cursor:'pointer', boxShadow:'none', transition:'transform .12s ease, box-shadow .15s ease, background .12s ease, border-color .12s ease' }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(0,0,0,.25)'; e.currentTarget.style.background='rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.85)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='rgba(255,255,255,0.6)'; }}
          >X</button>
        </div>
        {stage === 'info' && (
          <div>
            {quiz.preview_image_url && (
              <div style={{ width: '100%', height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
                <img alt="" src={toAbs(quiz.preview_image_url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ fontWeight: 900, fontSize: 38, color: '#dd2680', margin: '12px 0 8px', wordBreak:'break-word', overflowWrap:'anywhere' }}>{quiz.title}</div>
            <div style={{ opacity: 0.97, marginBottom: 18, fontSize: 22, lineHeight: 1.65, maxHeight: 180, overflowY:'auto', wordBreak:'break-word', overflowWrap:'anywhere' }}>{quiz.description}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 19, margin: '12px 0 22px' }}>
              <span style={{ background: '#ffe3f0', color: '#b3005d', padding: '8px 12px', borderRadius: 999, fontWeight: 800 }}>Course: <span style={{ fontWeight: 700 }}>{quiz?.course?.name || quiz?.course?.course_name || 'Personal'}</span></span>
              <span style={{ background: '#e6f4ff', color: '#1e5aa7', padding: '8px 12px', borderRadius: 999, fontWeight: 800 }}>{(quiz?.course_id ? 'Teacher' : 'Creator')}: <span style={{ fontWeight: 700 }}>{quiz?.creator?.username || quiz?.teacher?.username || 'Unknown'}</span></span>
              <span style={{ background: '#fff4e6', color: '#b26a00', padding: '8px 12px', borderRadius: 999, fontWeight: 800 }}>Published: <span style={{ fontWeight: 700 }}>{quiz?.published_at ? new Date(quiz.published_at).toLocaleDateString() : (quiz?.is_published ? (quiz?.updated_at ? new Date(quiz.updated_at).toLocaleDateString() : '—') : '—')}</span></span>
              <span style={{ background: '#efe7ff', color: '#5a33c7', padding: '8px 12px', borderRadius: 999, fontWeight: 800 }}>Items: <span style={{ fontWeight: 700 }}>{(quiz.items || []).length}</span></span>
              <span style={{ background: '#e8ffe8', color: '#207520', padding: '8px 12px', borderRadius: 999, fontWeight: 800 }}>Responses: <span style={{ fontWeight: 700 }}>{responsesCount}</span></span>
            </div>
            <div style={{ height:3, background:'#bbb', margin:'8px 0 18px', borderRadius:2 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 24 }}>
              <div />
              <div style={{ display: 'grid', justifyItems: 'end', rowGap: 6 }}>
                <button onClick={onStart} disabled={alreadyTaken && !quiz.is_repeatable}
                  style={{ padding: '14px 22px', borderRadius: 14, border: '2px solid #6a3ecb', background: (alreadyTaken && !quiz.is_repeatable) ? '#e0e0e0' : '#fff', color: (alreadyTaken && !quiz.is_repeatable) ? '#777' : '#6a3ecb', fontWeight: 900, fontSize: 20, fontFamily: 'Kodchasan, system-ui, sans-serif', boxShadow: '0 8px 18px rgba(106,62,203,.12)', transition: 'transform .12s ease, box-shadow .15s ease, background .12s ease, color .12s ease' }}
                  onMouseEnter={e => { if (!(alreadyTaken && !quiz.is_repeatable)) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(106,62,203,.22)'; e.currentTarget.style.background = '#6a3ecb'; e.currentTarget.style.color = '#fff'; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(106,62,203,.12)'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6a3ecb'; }}
                >{alreadyTaken ? (quiz.is_repeatable ? 'Retake' : 'Taken') : 'Start'}</button>
                {alreadyTaken && !quiz.is_repeatable && (
                  <div style={{ fontSize: 13, color: '#b00020' }}>You've already taken this quiz!</div>
                )}
              </div>
            </div>
          </div>
        )}
        {stage === 'paused' && (
          <div>
            <div style={{ fontWeight:900, marginBottom:6 }}>Quiz paused</div>
            <div style={{ opacity:0.8, marginBottom:12 }}>We found a previous in-progress attempt. Would you like to resume?</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setStage('taking')} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid transparent', background:'#6a3ecb', color:'#fff', fontWeight:800 }}>Resume</button>
              <button onClick={() => { localStorage.removeItem(key); setAnswers({}); setStage('info'); }} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #e6e0f4', background:'#fff', fontWeight:800 }}>Discard</button>
            </div>
          </div>
        )}
        {stage === 'taking' && (
          <div style={{ display:'grid', gap:18 }}>
            <div>
              <div style={{ fontWeight:900, fontSize:35, color:'#dd2680', margin:'4px 0 6px', wordBreak:'break-word', overflowWrap:'anywhere' }}>{quiz.title}</div>
              {quiz.description ? (
                <div style={{ opacity:0.95, fontSize:23, lineHeight:1.6, margin:'0 0 10px', maxHeight: 160, overflowY:'auto', wordBreak:'break-word', overflowWrap:'anywhere' }}>{quiz.description}</div>
              ) : null}
              <div style={{ display:'flex', flexWrap:'wrap', gap:12, fontSize:18, margin:'4px 0 10px' }}>
                <span style={{ background:'#ffe3f0', color:'#b3005d', padding:'8px 12px', borderRadius:999, fontWeight:800 }}>Course: <span style={{ fontWeight:700 }}>{quiz?.course?.name || quiz?.course?.course_name || 'Personal'}</span></span>
                <span style={{ background:'#e6f4ff', color:'#1e5aa7', padding:'8px 12px', borderRadius:999, fontWeight:800 }}>{(quiz?.course_id ? 'Teacher' : 'Creator')}: <span style={{ fontWeight:700 }}>{quiz?.creator?.username || quiz?.teacher?.username || 'Unknown'}</span></span>
                <span style={{ background:'#fff4e6', color:'#b26a00', padding:'8px 12px', borderRadius:999, fontWeight:800 }}>Published: <span style={{ fontWeight:700 }}>{quiz?.published_at ? new Date(quiz.published_at).toLocaleDateString() : (quiz?.is_published ? (quiz?.updated_at ? new Date(quiz.updated_at).toLocaleDateString() : '—') : '—')}</span></span>
                <span style={{ background:'#efe7ff', color:'#5a33c7', padding:'8px 12px', borderRadius:999, fontWeight:800 }}>Items: <span style={{ fontWeight:700 }}>{(quiz.items||[]).length}</span></span>
              </div>
              <div style={{ height:3, background:'#bbb', margin:'6px 0 8px', borderRadius:2 }} />
            </div>
            {(() => {
              const it = (quiz.items||[])[currentIdx];
              const idx = currentIdx;
              const itemType = (it.type || '').toLowerCase();
              const rawImg = it.image_url || it.image_path || it.image || it.photo_url || it.photo || it.img_url || it.attachment_url || it?.meta?.image_url || it?.meta?.image_path || it?.meta?.image || '';
              const imgUrl = rawImg ? toAbs(rawImg) : '';
              const imgCandidates = rawImg ? [
                toAbs(rawImg),
                toAbs(rawImg.replace('/quiz_images/','/storage/quiz_images/')),
                toAbs(rawImg.replace('/quiz_images/','/public/quiz_images/')),
                toAbs(rawImg.replace('/quiz_media/','/storage/quiz_media/')),
                toAbs(rawImg.replace('/quiz_media/','/public/quiz_media/')),
              ] : [];
              const rawMedia = it.media_url || it.media_path || it.video_url || it.video_path || it.audio_url || it.audio_path || it.file_url || it?.meta?.media_url || it?.meta?.media_path || '';
              const mediaUrl = rawMedia ? toAbs(rawMedia) : '';
              return (
                <div key={it.id} style={{ border:'2px solid #6a3ecb', borderRadius:12, padding:14, boxShadow:'0 10px 22px rgba(106,62,203,0.12)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                    <div style={{ fontWeight:800, fontSize:23, lineHeight:1.25, wordBreak:'break-word', overflowWrap:'anywhere' }}>{idx+1}. {it.question}</div>
                  </div>
                  {imgUrl && (
                    <div
                      style={{ width:'100%', height:imgH, borderRadius:10, overflow:'auto', marginBottom:10, background:'#fafafa', border:'1px solid #eee', cursor:'zoom-in' }}
                      onClick={()=> setFullImg(imgUrl) }
                      title="Click to view full image"
                    >
                      <img
                        alt=""
                        src={imgCandidates[0]}
                        data-idx="0"
                        onError={(e)=>{
                          const idx = Number(e.currentTarget.dataset.idx || 0) + 1;
                          if (idx < imgCandidates.length) {
                            e.currentTarget.dataset.idx = String(idx);
                            e.currentTarget.src = imgCandidates[idx];
                          } else {
                            e.currentTarget.onerror = null;
                          }
                        }}
                        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                      />
                    </div>
                  )}
                  {mediaUrl && (
                    <div style={{ marginBottom:10 }}>
                      {((it.media_type || '').toLowerCase() === 'video' || String(mediaUrl).toLowerCase().includes('.mp4')) ? (
                        <video controls style={{ width:'100%', maxHeight:260, borderRadius:8 }}>
                          <source src={mediaUrl} type="video/mp4" />
                          <source src={mediaUrl.replace('/quiz_media/','/storage/quiz_media/')} type="video/mp4" />
                          <source src={mediaUrl.replace('/storage/','/public/')} type="video/mp4" />
                        </video>
                      ) : (
                        <audio controls>
                          <source src={mediaUrl} />
                          <source src={mediaUrl.replace('/quiz_media/','/storage/quiz_media/')} />
                          <source src={mediaUrl.replace('/storage/','/public/')} />
                        </audio>
                      )}
                    </div>
                  )}
                  {itemType === 'identification' && (
                    <input
                      value={answers[it.id] || ''}
                      onChange={e=>setAnswer(it.id, e.target.value)}
                      placeholder="Your answer"
                      style={{ padding:12, borderRadius:12, border:'2px solid #6a3ecb', width:'100%', maxWidth:'100%', boxSizing:'border-box', display:'block', fontSize:20, wordBreak:'break-word', overflowWrap:'anywhere' }}
                    />
                  )}
                  {itemType === 'multiple_choice' && (
                    <div style={{ display:'grid', gap:6 }}>
                      {(it.choices||[]).map(c => (
                        <label key={c.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <input type="radio" name={`q-${it.id}`} checked={String(answers[it.id]||'')===String(c.id)} onChange={()=>setAnswer(it.id, c.id)} />
                          <span style={{ wordBreak:'break-word', overflowWrap:'anywhere', fontSize:18 }}>{c.choice_text}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {itemType === 'multiple_answer' && (
                    <div style={{ display:'grid', gap:6 }}>
                      {(it.choices||[]).map(c => (
                        <label key={c.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <input type="checkbox" checked={Array.isArray(answers[it.id]) ? answers[it.id].includes(c.id) : false}
                            onChange={e => {
                              const prev = Array.isArray(answers[it.id]) ? answers[it.id] : [];
                              if (e.target.checked) setAnswer(it.id, [...prev, c.id]);
                              else setAnswer(it.id, prev.filter(x => x !== c.id));
                            }} />
                          <span style={{ wordBreak:'break-word', overflowWrap:'anywhere' }}>{c.choice_text}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {itemType === 'true_false' && (
                    <div style={{ display:'flex', gap:16 }}>
                      <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:18 }}>
                        <input type="radio" name={`tf-${it.id}`} checked={String(answers[it.id]||'')==='True'} onChange={()=>setAnswer(it.id, 'True')} /> True
                      </label>
                      <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:18 }}>
                        <input type="radio" name={`tf-${it.id}`} checked={String(answers[it.id]||'')==='False'} onChange={()=>setAnswer(it.id, 'False')} /> False
                      </label>
                    </div>
                  )}
                  {itemType === 'matching' && Array.isArray(it?.meta?.pairs) && (
                    <div style={{ display:'grid', gap:8 }}>
                      {(it.meta.pairs||[]).map((p, i) => (
                        <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <div style={{ fontWeight:800, minWidth:120, wordBreak:'break-word', overflowWrap:'anywhere', fontSize:18 }}>{p.left}</div>
                          <span>→</span>
                          <select value={(answers[it.id]?.[p.left])||''} onChange={e=>{
                            const prev = answers[it.id] && typeof answers[it.id]==='object' ? { ...answers[it.id] } : {};
                            prev[p.left] = e.target.value; setAnswer(it.id, prev);
                          }} style={{ padding:10, borderRadius:10, border:'1px solid #e6e0f4', fontSize:18 }}>
                            <option value="">Select</option>
                            {(it.meta.pairs||[]).map((opt, j) => (
                              <option key={j} value={opt.right}>{opt.right}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                  {itemType === 'ordering' && Array.isArray(it?.meta?.order) && (
                    <div style={{ display:'grid', gap:6 }}>
                      {(() => {
                        const current = Array.isArray(answers[it.id]) && answers[it.id].length ? answers[it.id] : (shuffles[it.id] || it.meta.order || []);
                        return current.map((s, i) => (
                          <div
                            key={i}
                            draggable
                            onDragStart={e=>{ try{ e.dataTransfer.setData('text/plain', String(i)); }catch(_){} setDragIndex(i); }}
                            onDragOver={e=>{ e.preventDefault(); }}
                            onDrop={e=>{
                              e.preventDefault();
                              let from = dragIndex;
                              try { const dt = e.dataTransfer.getData('text/plain'); if (dt !== '') from = Number(dt); } catch(_) {}
                              if (typeof from === 'number' && !Number.isNaN(from)) {
                                const arr = [...current];
                                const [m] = arr.splice(from, 1);
                                arr.splice(i, 0, m);
                                setAnswer(it.id, arr);
                              }
                              setDragIndex(null);
                            }}
                            onDragEnd={()=> setDragIndex(null)}
                            style={{ display:'flex', gap:8, alignItems:'center', padding:4, borderRadius:8, background:(dragIndex===i?'#f7f2ff':'transparent') }}
                          >
                            <div title="Drag to reorder" style={{ cursor:'grab', userSelect:'none', padding:'10px 14px', border:'2px solid #000', borderRadius:12, flex:1, wordBreak:'break-word', overflowWrap:'anywhere', background:'#fcb00d', color:'#000', fontSize:18 }}>{s}</div>
                            <button className="qd-btn-anim" title="Move up" onClick={()=>{ const arr = [...current]; if (i>0){ const t=arr[i-1]; arr[i-1]=arr[i]; arr[i]=t; } setAnswer(it.id, arr); }}
                              style={{ pointerEvents: dragIndex===i ? 'none':'auto', padding:'8px 12px', borderRadius:999, border:'2px solid #b26a00', background:'#ffae0c', color:'#3e2a6d', fontWeight:900 }}>▲</button>
                            <button className="qd-btn-anim" title="Move down" onClick={()=>{ const arr = [...current]; if (i<arr.length-1){ const t=arr[i+1]; arr[i+1]=arr[i]; arr[i]=t; } setAnswer(it.id, arr); }}
                              style={{ pointerEvents: dragIndex===i ? 'none':'auto', padding:'8px 12px', borderRadius:999, border:'2px solid #b26a00', background:'#ffae0c', color:'#3e2a6d', fontWeight:900 }}>▼</button>
                          </div>
                        ));
                      })()}
                      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
                        <button
                          title="Lock the current order"
                          onClick={() => {
                            try {
                              const current = Array.isArray(answers[it.id]) && answers[it.id].length ? answers[it.id] : (shuffles[it.id] || it.meta.order || []);
                              setAnswer(it.id, [...current]);
                              try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'info', message: 'Order locked for this item' } })); } catch(_) {}
                            } catch(_) {}
                          }}
                          style={{ padding:'6px 10px', borderRadius:10, border:'1px solid #e6e0f4', background:'#fff', color:'#6a3ecb', fontWeight:800, fontFamily:'Kodchasan, system-ui', transition:'transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                          onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.background='#f7f3ff'; }}
                          onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.background='#fff'; }}
                        >Lock order</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            <div style={{ marginTop:12 }}>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={(quiz.items||[]).length} aria-valuenow={currentIdx+1}
                style={{ position:'relative', height:10, borderRadius:999, overflow:'hidden', background:'#f3edff', border:'1px solid #d6c7ff', boxShadow:'inset 0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ height:'100%', width:`${Math.max(0, Math.min(100, ((currentIdx+1)/Math.max(1,(quiz.items||[]).length))*100))}%`, background:'linear-gradient(90deg, #6a3ecb, #dd2680, #ffae0c)', transition:'width .25s ease' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
              <button
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={forwardOnly || currentIdx === 0}
                style={{ padding:'10px 16px', borderRadius:12, border:'2px solid #6a3ecb', background:(forwardOnly || currentIdx===0) ? '#f2f2f2' : '#fff', color:(forwardOnly || currentIdx===0) ? '#777' : '#6a3ecb', fontWeight:900, fontFamily:'Kodchasan, system-ui', opacity:(forwardOnly || currentIdx===0) ? 0.6 : 1, transition:'transform .12s ease, box-shadow .15s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                onMouseEnter={e=>{ if(!(forwardOnly||currentIdx===0)){ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 16px rgba(106,62,203,.18)'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; }} }
                onMouseLeave={e=>{ if(!(forwardOnly||currentIdx===0)){ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; } }}
              >Previous</button>
              <div style={{ fontSize:12, opacity:0.7 }}>{saving ? 'Saving…' : 'Autosave every 10s. Closing will pause this quiz.'}</div>
              {currentIdx < (quiz.items||[]).length - 1 ? (
                <button
                  onClick={() => setCurrentIdx(i => Math.min((quiz.items||[]).length - 1, i + 1))}
                  style={{ padding:'10px 16px', borderRadius:12, border:'2px solid #dd2680', background:'#dd2680', color:'#fff', fontWeight:900, fontFamily:'Kodchasan, system-ui', transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease' }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#dd2680'; e.currentTarget.style.boxShadow='0 10px 20px rgba(221,38,128,.18)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='#dd2680'; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='none'; }}
                >Next</button>
              ) : (
                <button
                  onClick={onSubmit}
                  style={{ padding:'10px 16px', borderRadius:12, border:'2px solid #dd2680', background:'#dd2680', color:'#fff', fontWeight:900, fontFamily:'Kodchasan, system-ui', transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease' }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#dd2680'; e.currentTarget.style.boxShadow='0 10px 20px rgba(221,38,128,.18)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='#dd2680'; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='none'; }}
                >Submit</button>
              )}
            </div>
            </div>
          </div>
        )}
        {stage === 'result' && (
          <div>
            {(() => {
              const got = Number(score?.score||0);
              const tot = Math.max(0, Number(score?.total||0));
              const pct = tot>0 ? Math.round((got/tot)*100) : 0;
              // Animate ring on mount/change
              try {
                // simple rAF tween
                const target = pct;
                const start = ringPct;
                const startTs = performance.now();
                const dur = 800;
                let raf;
                const tick = (t)=>{
                  const k = Math.min(1, (t - startTs)/dur);
                  const val = Math.round(start + (target - start) * (0.5 - Math.cos(Math.PI*k)/2));
                  setRingPct(val);
                  if (k < 1) raf = requestAnimationFrame(tick);
                };
                if (start !== target) {
                  if (typeof raf !== 'undefined') cancelAnimationFrame(raf);
                  requestAnimationFrame(tick);
                }
              } catch(_) { setRingPct(pct); }
              let msg = "That's too bad! Study harder!"; // < 25%
              if (pct === 25) msg = "Don't worry! Studying is key to success!";
              else if (pct > 25 && pct < 50) msg = "Don't worry! Studying is key to success!";
              else if (pct === 50) msg = 'Not bad, but could be better!';
              else if (pct > 50 && pct < 80) msg = 'Not bad, but could be better!';
              else if (pct === 80) msg = 'Good Job! Keep it up, homie!';
              else if (pct > 80 && pct < 100) msg = 'Good Job! Keep it up, homie!';
              else if (pct === 100) msg = 'Perfect Score! Way to go, homie!';
              const ring = `conic-gradient(#dd2680 0% ${ringPct}%, #ffd6d6 ${ringPct}% 100%)`;
              const light = pct>=80? '#e8ffe8' : (pct>=50? '#fffbe6' : '#ffeaea');
              const textCol = pct>=80? '#207520' : (pct>=50? '#8a6d00' : '#9b1c1c');
              const cardBg = '#fff';
              const list = Array.isArray(quiz?.items) ? quiz.items : [];
              const isTrue = (v) => v === true || v === 1 || v === '1' || (typeof v==='string' && v.toLowerCase()==='true');
              const typeLabel = (s) => {
                const t = String(s || '').replace(/_/g, ' ');
                return t.split(' ').map(w => w ? (w[0].toUpperCase() + w.slice(1)) : '').join(' ');
              };
              function userAnswer(it){
                const rec = resultMap[it.id];
                if (!rec) return { text: '', correct: null };
                const sel = rec.selected;
                const correct = isTrue(rec.is_correct);
                const t = String(it.type||'').toLowerCase();
                if (t==='identification') return { text: String(sel||'') || '—', correct };
                if (t==='true_false') {
                  const choices = Array.isArray(it.choices) ? it.choices : [];
                  let label = '';
                  if (typeof sel === 'string' || typeof sel === 'number') {
                    const byId = choices.find(c => String(c.id) === String(sel));
                    if (byId) label = String(byId.choice_text || byId.label || '');
                  }
                  if (!label && typeof sel === 'string') {
                    // fallback if backend stored 'True'/'False'
                    const byText = choices.find(c => String((c.choice_text ?? c.label ?? '')).trim().toLowerCase() === sel.trim().toLowerCase());
                    if (byText) label = String(byText.choice_text || byText.label || '');
                  }
                  return { text: label || String(sel||'') || '—', correct };
                }
                if (t==='multiple_choice') {
                  const choice = (it.choices||[]).find(c => String(c.id)===String(sel));
                  return { text: choice ? (choice.choice_text||`#${choice.id}`) : (String(sel||'')||'—'), correct };
                }
                if (t==='multiple_answer') {
                  const arr = Array.isArray(sel) ? sel : [];
                  const labels = arr.map(id=>{
                    const c = (it.choices||[]).find(x=>String(x.id)===String(id));
                    return c ? (c.choice_text||`#${c.id}`) : `#${id}`;
                  });
                  return { text: labels.join(', ') || '—', correct };
                }
                if (t==='ordering') {
                  const arr = Array.isArray(sel) ? sel : [];
                  return { text: arr.join('  →  ') || '—', correct };
                }
                if (t==='matching') {
                  const obj = sel && typeof sel==='object' ? sel : {};
                  const pairs = Object.keys(obj).map(k=>`${k} → ${obj[k]}`);
                  return { text: pairs.join(' | ') || '—', correct };
                }
                return { text: '', correct: rec.is_correct };
              }
              function rightAnswer(it){
                const t = String(it.type||'').toLowerCase();
                if (t==='identification') return String(it.correct_answer||'');
                if (t==='true_false') {
                  const c = (it.choices||[]).find(x=>x.is_correct);
                  return c ? String(c.choice_text||c.label||'True') : 'True';
                }
                if (t==='multiple_choice') {
                  const c = (it.choices||[]).find(x=>x.is_correct);
                  return c ? (c.choice_text||`#${c.id}`) : '';
                }
                if (t==='multiple_answer') {
                  const cs = (it.choices||[]).filter(x=>x.is_correct).map(c=>c.choice_text||`#${c.id}`);
                  return cs.join(', ');
                }
                if (t==='ordering') {
                  const arr = Array.isArray(it?.meta?.order)? it.meta.order : [];
                  return arr.join('  →  ');
                }
                if (t==='matching') {
                  const pairs = Array.isArray(it?.meta?.pairs)? it.meta.pairs : [];
                  return pairs.map(p=>`${p.left} → ${p.right}`).join(' | ');
                }
                return '';
              }
              return (
                <div style={{ display:'grid', gridTemplateColumns:'minmax(240px, 1fr) minmax(340px, 1.6fr)', gap:16, alignItems:'start' }}>
                  <div style={{ background:cardBg, border:'2px solid #6a3ecb', borderRadius:16, padding:18, boxShadow:'0 12px 24px rgba(106,62,203,.12)', minWidth:0, overflowX:'hidden' }}>
                    <div style={{ display:'grid', justifyItems:'center', alignItems:'center', rowGap:12 }}>
                      <div style={{ width:210, height:210, borderRadius:'50%', background:ring, position:'relative', display:'grid', placeItems:'center', boxShadow:'inset 0 0 0 10px rgba(255,255,255,0.75)' }}>
                        <div style={{ width:160, height:160, background:'#fff', borderRadius:'50%', display:'grid', placeItems:'center', border:'6px solid rgba(106,62,203,0.12)' }}>
                          <div style={{ fontWeight:900, fontSize:38, color:'#6a3ecb' }}>{pct}%</div>
                        </div>
                      </div>
                      <div style={{ fontWeight:900, fontSize:24, color:'#dd2680' }}>You scored {got} out of {tot}!</div>
                      <div style={{ background:light, color:textCol, padding:'10px 14px', borderRadius:12, fontWeight:800, border:'1px solid rgba(0,0,0,0.06)', textAlign:'center' }}>{msg}</div>
                    </div>
                    <div style={{ marginTop:16, display:'flex', gap:10, justifyContent:'center' }}>
                      <button onClick={onClose}
                        style={{ padding:'12px 16px', borderRadius:12, border:'2px solid #e6e0f4', background:'#fff', fontWeight:900, fontFamily:'Kodchasan, system-ui', transition:'transform .12s ease, box-shadow .15s ease, background .12s ease, color .12s ease' }}
                        onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 10px 22px rgba(0,0,0,.12)'; }}
                        onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
                      >Exit</button>
                      <button
                        onClick={onStart}
                        disabled={!quiz?.is_repeatable}
                        style={{ padding:'12px 16px', borderRadius:12, border:'2px solid #6a3ecb', background: quiz?.is_repeatable ? '#fff' : '#f0f0f0', color: quiz?.is_repeatable ? '#6a3ecb' : '#777', fontWeight:900, fontFamily:'Kodchasan, system-ui', boxShadow:'0 10px 22px rgba(0,0,0,.06)', opacity: quiz?.is_repeatable ? 1 : 0.7, transition:'transform .12s ease, box-shadow .15s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
                        onMouseEnter={e=>{ if(quiz?.is_repeatable){ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 12px 26px rgba(106,62,203,.18)'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.borderColor='#6a3ecb'; }} }
                        onMouseLeave={e=>{ if(quiz?.is_repeatable){ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 10px 22px rgba(0,0,0,.06)'; e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.borderColor='#6a3ecb'; }} }
                      >Retake</button>
                    </div>
                  </div>
                  <div style={{ background:cardBg, border:'2px solid #ffae0c', borderRadius:16, padding:14, boxShadow:'0 12px 24px rgba(255,174,12,.12)', maxHeight:'56vh', overflow:'auto', minWidth:0, overflowX:'hidden' }}>
                    <div style={{ fontWeight:900, fontSize:22, color:'#b26a00', marginBottom:6 }}>Review Answers</div>
                    <div style={{ display:'grid', gap:10, minWidth:0, overflowX:'hidden' }}>
                      {list.map((it,i)=>{
                        const img = it.image_url || it.image_path || it.image || it.photo_url || it.photo || it.img_url || it.attachment_url || it?.meta?.image_url || it?.meta?.image_path || it?.meta?.image || '';
                        const imgUrl = img ? toAbs(img) : '';
                        const itemType = String(it.type||'').toLowerCase();
                        const ua = userAnswer(it);
                        const ans = (()=>{
                          if (itemType==='identification') return String(it.correct_answer||'');
                          if (itemType==='true_false') {
                            const c = (it.choices||[]).find(x=>x.is_correct);
                            return c ? (c.choice_text||c.label||'True') : '';
                          }
                          if (itemType==='multiple_choice') {
                            const c = (it.choices||[]).find(x=>x.is_correct);
                            return c ? (c.choice_text||`#${c.id}`) : '';
                          }
                          if (itemType==='multiple_answer') {
                            const cs = (it.choices||[]).filter(x=>x.is_correct).map(c=>c.choice_text||`#${c.id}`);
                            return cs.join(', ');
                          }
                          if (itemType==='ordering') {
                            const arr = Array.isArray(it?.meta?.order)? it.meta.order : [];
                            return arr.join('  →  ');
                          }
                          if (itemType==='matching') {
                            const pairs = Array.isArray(it?.meta?.pairs)? it.meta.pairs : [];
                            return pairs.map(p=>`${p.left} → ${p.right}`).join(' | ');
                          }
                          return '';
                        })();
                        return (
                          <div key={it.id} style={{ border:'1px solid #f3e2c5', borderRadius:12, padding:12, background:'#fffdf7' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10 }}>
                              <div style={{ fontWeight:900, color:'#3e2a6d', fontSize:18, lineHeight:1.3, wordBreak:'break-word', overflowWrap:'anywhere' }}>{i+1}. {it.question}</div>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ background:'#fff4e6', color:'#b26a00', padding:'4px 8px', borderRadius:999, fontWeight:800, fontSize:12 }}>{typeLabel(it.type)}</div>
                                <div style={{ background: ua.correct===true ? '#e8ffe8' : (ua.correct===false ? '#ffeaea' : '#eef2ff'), color: ua.correct===true ? '#207520' : (ua.correct===false ? '#9b1c1c' : '#3e2a6d'), padding:'4px 8px', borderRadius:999, fontWeight:800, fontSize:12, border:'1px solid rgba(0,0,0,0.06)' }}>
                                  {ua.correct===true ? 'Correct' : (ua.correct===false ? 'Incorrect' : 'Checked')}
                                </div>
                              </div>
                            </div>
                            {imgUrl && (
                              <div
                                onClick={()=> setFullImg(imgUrl)}
                                title="Click to view full image"
                                style={{
                                  margin:'8px auto 0',
                                  cursor:'zoom-in',
                                  borderRadius:10,
                                  overflow:'hidden',
                                  maxHeight:220,
                                  width:'100%',
                                  maxWidth:360,
                                  background:'#fafafa',
                                  border:'1px solid #eee'
                                }}
                              >
                                <img
                                  alt=""
                                  src={imgUrl}
                                  style={{ width:'100%', height:'auto', maxHeight:220, objectFit:'contain', display:'block' }}
                                />
                              </div>
                            )}
                            <div style={{ marginTop:8, fontSize:16, display:'grid', gap:4, minWidth:0 }}>
                              <div>
                                <span style={{ fontWeight:800, color: ua.correct===true ? '#207520' : (ua.correct===false ? '#9b1c1c' : '#555') }}>Your answer:</span>
                                <span style={{ fontWeight:700, marginLeft:6, color: ua.correct===true ? '#207520' : (ua.correct===false ? '#9b1c1c' : '#333'), wordBreak:'break-word', overflowWrap:'anywhere' }}>{ua.text || '—'}</span>
                                {ua.correct===true && <span style={{ marginLeft:8, color:'#207520', fontWeight:800 }}>✓</span>}
                                {ua.correct===false && <span style={{ marginLeft:8, color:'#9b1c1c', fontWeight:800 }}>✗</span>}
                              </div>
                              <span style={{ display:'block', minWidth:0 }}><span style={{ fontWeight:800, color:'#207520' }}>Correct answer:</span> <span style={{ fontWeight:700, wordBreak:'break-word', overflowWrap:'anywhere' }}>{ans || rightAnswer(it) || '—'}</span></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      {fullImg && (
        <div
          onClick={() => setFullImg('')}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ position:'relative', maxWidth:'96vw', maxHeight:'92vh', background:'#000', borderRadius:12, overflow:'auto', padding:10 }}>
            <button
              onClick={() => setFullImg('')}
              title="Close"
              style={{ position:'absolute', top:8, right:10, width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,0.45)', background:'rgba(255,255,255,0.10)', color:'#fff', fontWeight:900, cursor:'pointer', transition:'transform .12s ease, box-shadow .15s ease, background .12s ease, border-color .12s ease' }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 10px 20px rgba(0,0,0,.3)'; e.currentTarget.style.background='rgba(255,255,255,0.18)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.8)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.45)'; }}
            >×</button>
            <img alt="Attachment" src={fullImg} style={{ maxWidth:'92vw', maxHeight:'86vh', display:'block', margin:'0 auto' }} />
          </div>
        </div>
      )}
    </div>
  );
}
