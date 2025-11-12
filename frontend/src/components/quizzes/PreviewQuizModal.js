import React, { useEffect, useMemo, useRef, useState } from 'react';
import { quizzesApi } from '../../hooks/quizzes';
import { API_BASE } from '../../api';

export default function PreviewQuizModal({ token, quizId, onClose }) {
  const qapi = useMemo(() => quizzesApi(token), [token]);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [imgH, setImgH] = useState(200);
  const [fullImg, setFullImg] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const apiBase = API_BASE;
  const assetBase = (process.env.REACT_APP_ASSET_BASE || '').replace(/\/$/, '');
  const toAbs = (p) => {
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    const clean = p.startsWith('/') ? p.slice(1) : p;
    if (assetBase && (/^(quiz_images|quiz_media)\//i.test(clean) || /^storage\/(quiz_images|quiz_media)\//i.test(clean))) {
      return `${assetBase}/${clean}`;
    }
    return `${apiBase}${p.startsWith('/') ? p : `/${p}`}`;
  };
  const [shuffles, setShuffles] = useState({});
  const navMode = (typeof window !== 'undefined' ? (localStorage.getItem(`quiz_nav_mode_${quizId}`) || 'both') : 'both');
  const forwardOnly = navMode === 'forward';
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
      try {
        const q = await qapi.get(quizId);
        if (mounted) {
          setQuiz(q);
          const s = {};
          (q.items||[]).forEach(it => {
            const type = String(it.type||'').toLowerCase();
            if (type === 'ordering') s[it.id] = shuffle(it.meta?.order || []);
          });
          setShuffles(s);
        }
      } catch (_) {}
    }
    if (fetchedRef.current.id !== quizId) {
      fetchedRef.current.id = quizId;
      load();
    }
    return () => { mounted = false; };
  }, [quizId, qapi]);

  // Reset adjustable image height on question change
  useEffect(() => { setImgH(200); }, [currentIdx]);

  function setAnswer(itemId, value) { setAnswers(prev => ({ ...prev, [itemId]: value })); }

  if (!quiz) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', backdropFilter:'blur(2px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, animation:'fadeIn .18s ease-out' }}>
      <style>{`@keyframes popIn {0%{transform:scale(.96);opacity:.0} 70%{transform:scale(1.02);opacity:.98} 100%{transform:scale(1);opacity:1}} @keyframes fadeIn {from{opacity:0} to{opacity:1}}`}</style>
      <div style={{ width:'min(900px, 96vw)', maxHeight:'90vh', overflow:'auto', background:'#fff', borderRadius:16, padding:24, boxShadow:'0 14px 36px rgba(0,0,0,0.2)', animation:'popIn .18s ease-out', fontFamily:'Kodchasan, system-ui, sans-serif' }}>
        <div style={{ background:'#dd2680', padding:8, margin:'-24px -24px 18px', borderTopLeftRadius:16, borderTopRightRadius:16, display:'flex', justifyContent:'flex-end', alignItems:'center' }}>
          <button onClick={onClose} title="Close"
            style={{ width:44, height:44, borderRadius:12, border:'1px solid rgba(255,255,255,0.6)', background:'transparent', color:'#fff', fontWeight:900, fontSize:28, lineHeight:'28px', cursor:'pointer', boxShadow:'none', transition:'transform .12s ease, box-shadow .15s ease, background .12s ease, border-color .12s ease' }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(0,0,0,.25)'; e.currentTarget.style.background='rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.85)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='rgba(255,255,255,0.6)'; }}
          >X</button>
        </div>

        <div>
          <div style={{ fontWeight:900, fontSize:35, color:'#dd2680', margin:'4px 0 6px', wordBreak:'break-word', overflowWrap:'anywhere' }}>{quiz.title}</div>
          {quiz.description ? (
            <div style={{ opacity:0.95, fontSize:23, lineHeight:1.6, margin:'0 0 10px', maxHeight:160, overflowY:'auto', wordBreak:'break-word', overflowWrap:'anywhere' }}>{quiz.description}</div>
          ) : null}
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, fontSize:18, margin:'4px 0 10px' }}>
            <span style={{ background:'#ffe3f0', color:'#b3005d', padding:'8px 12px', borderRadius:999, fontWeight:800 }}>Course: <span style={{ fontWeight:700 }}>{quiz?.course?.name || quiz?.course?.course_name || 'Personal'}</span></span>
            <span style={{ background:'#e6f4ff', color:'#1e5aa7', padding:'8px 12px', borderRadius:999, fontWeight:800 }}>{(quiz?.course_id ? 'Teacher' : 'Creator')}: <span style={{ fontWeight:700 }}>{quiz?.creator?.username || quiz?.teacher?.username || 'Unknown'}</span></span>
            <span style={{ background:'#fff4e6', color:'#b26a00', padding:'8px 12px', borderRadius:999, fontWeight:800 }}>Published: <span style={{ fontWeight:700 }}>{quiz?.published_at ? new Date(quiz.published_at).toLocaleDateString() : (quiz?.is_published ? (quiz?.updated_at ? new Date(quiz.updated_at).toLocaleDateString() : '—') : '—')}</span></span>
            <span style={{ background:'#efe7ff', color:'#5a33c7', padding:'8px 12px', borderRadius:999, fontWeight:800 }}>Items: <span style={{ fontWeight:700 }}>{(quiz.items||[]).length}</span></span>
          </div>
          <div style={{ height:3, background:'#bbb', margin:'6px 0 8px', borderRadius:2 }} />
        </div>

        <div style={{ display:'grid', gap:12 }}>
          {(() => {
            const it = (quiz.items||[])[currentIdx];
            const idx = currentIdx;
            const itemType = (it.type||'').toLowerCase();
            const rawImg = it.image_url || it.image_path || it.image || it.photo_url || it.photo || it.img_url || it.attachment_url || it.attachment_path || it.attachment || it?.meta?.image_url || it?.meta?.image_path || it?.meta?.image || '';
            const imgUrl = rawImg ? toAbs(rawImg) : '';
            const imgCandidates = rawImg ? [
              toAbs(rawImg),
              toAbs(rawImg.replace('/quiz_images/','/storage/quiz_images/')),
              toAbs(rawImg.replace('/quiz_images/','/public/quiz_images/')),
              toAbs(rawImg.replace('/quiz_media/','/storage/quiz_media/')),
              toAbs(rawImg.replace('/quiz_media/','/public/quiz_media/')),
            ] : [];
            const rawMedia = it.media_url || it.media_path || it.video_url || it.video_path || it.audio_url || it.audio_path || it.file_url || it.attachment_url || it.attachment_path || it?.meta?.media_url || it?.meta?.media_path || '';
            const mediaUrl = rawMedia ? toAbs(rawMedia) : '';
            return (
              <div key={it.id} style={{ border:'2px solid #6a3ecb', borderRadius:12, padding:12, boxShadow:'0 10px 22px rgba(106,62,203,0.12)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
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
                  <div style={{ marginBottom:8 }}>
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
                        <span style={{ wordBreak:'break-word', overflowWrap:'anywhere', fontSize:18 }}>{c.choice_text}</span>
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
                            style={{ pointerEvents: dragIndex===i ? 'none':'auto', padding:'8px 12px', borderRadius:999, border:'1px solid #ffe08a', background:'#fff9e6', color:'#b26a00', fontWeight:900 }}>▲</button>
                          <button className="qd-btn-anim" title="Move down" onClick={()=>{ const arr = [...current]; if (i<arr.length-1){ const t=arr[i+1]; arr[i+1]=arr[i]; arr[i]=t; } setAnswer(it.id, arr); }}
                            style={{ pointerEvents: dragIndex===i ? 'none':'auto', padding:'8px 12px', borderRadius:999, border:'1px solid #ffe08a', background:'#fff9e6', color:'#b26a00', fontWeight:900 }}>▼</button>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        <div style={{ marginTop:12 }}>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={(quiz.items||[]).length} aria-valuenow={currentIdx+1}
            style={{ position:'relative', height:10, borderRadius:999, overflow:'hidden', background:'#f3edff', border:'1px solid #d6c7ff', boxShadow:'inset 0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ height:'100%', width:`${Math.max(0, Math.min(100, ((currentIdx+1)/Math.max(1,(quiz.items||[]).length))*100))}%`, background:'linear-gradient(90deg, #6a3ecb, #dd2680, #ffae0c)', transition:'width .25s ease' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
          <button
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={forwardOnly || currentIdx === 0}
            style={{ padding:'10px 14px', borderRadius:10, border:'2px solid #6a3ecb', background:(forwardOnly || currentIdx===0) ? '#f2f2f2' : '#fff', color:(forwardOnly || currentIdx===0) ? '#777' : '#6a3ecb', fontWeight:900, opacity:(forwardOnly || currentIdx===0) ? 0.6 : 1, transition:'transform .12s ease, box-shadow .15s ease, background .12s ease, color .12s ease, border-color .12s ease' }}
            onMouseEnter={e=>{ if(!(forwardOnly||currentIdx===0)){ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 16px rgba(106,62,203,.18)'; e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; } }}
            onMouseLeave={e=>{ if(!(forwardOnly||currentIdx===0)){ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; } }}
          >Previous</button>
          <div style={{ fontSize:12, opacity:0.7 }}>No grades recorded in preview.</div>
          {currentIdx < (quiz.items||[]).length - 1 ? (
            <button
              onClick={() => setCurrentIdx(i => Math.min((quiz.items||[]).length - 1, i + 1))}
              style={{ padding:'10px 14px', borderRadius:10, border:'2px solid #6a3ecb', background:'#6a3ecb', color:'#fff', fontWeight:900, transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease' }}
              onMouseEnter={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.boxShadow='0 10px 20px rgba(106,62,203,.18)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='none'; }}
            >Next</button>
          ) : (
            <button onClick={onClose} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #e6e0f4', background:'#fff', fontWeight:800 }}>Close</button>
          )}
        </div>
        </div>
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
