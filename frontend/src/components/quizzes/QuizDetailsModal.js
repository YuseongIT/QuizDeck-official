import React, { useEffect, useMemo, useRef, useState } from 'react';
import { quizzesApi, quizItemsApi, gradesApi } from '../../hooks/quizzes';

export default function QuizDetailsModal({ token, user, quiz: initialQuiz, open, onClose, onUpdated, onDeleted, onPublished, onManage, onTake }) {
  const qapi = useMemo(() => quizzesApi(token), [token]);
  const iapi = useMemo(() => quizItemsApi(token), [token]);
  const gapi = useMemo(() => gradesApi(token), [token]);
  const isTeacher = user?.role === 'teacher';
  const [quiz, setQuiz] = useState(initialQuiz);
  const [title, setTitle] = useState(initialQuiz?.title || '');
  const [description, setDescription] = useState(initialQuiz?.description || '');
  const [isRepeatable, setIsRepeatable] = useState(!!initialQuiz?.is_repeatable);
  const [isAvailable, setIsAvailable] = useState(!!initialQuiz?.is_available);
  const [isShared, setIsShared] = useState(!!initialQuiz?.is_shared);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(initialQuiz?.preview_image_url || '');
  const [itemsCount, setItemsCount] = useState(typeof initialQuiz?.items_count === 'number' ? initialQuiz.items_count : null);
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [responseCount, setResponseCount] = useState(null);
  const [confirmDlg, setConfirmDlg] = useState({ open:false, message:'', onYes:null });
  const fetchSeqRef = useRef(0);
  const toArray = (d) => (Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : (Array.isArray(d?.rows) ? d.rows : [])));

  useEffect(() => { setQuiz(initialQuiz); setTitle(initialQuiz?.title || ''); setDescription(initialQuiz?.description || ''); setIsRepeatable(!!initialQuiz?.is_repeatable); setIsAvailable(!!initialQuiz?.is_available); setIsShared(!!initialQuiz?.is_shared); setImagePreview(initialQuiz?.preview_image_url || ''); }, [initialQuiz]);

  // Fetch fresh quiz with relations when opening, so course/creator are present
  const fetchedQuizRef = useRef({ id: null, open: false });
  useEffect(() => {
    let mounted = true;
    async function refresh() {
      if (!open || !initialQuiz?.id) return;
      try {
        const fresh = await qapi.get(initialQuiz.id);
        if (!mounted) return;
        setQuiz(fresh);
        setTitle(fresh?.title || '');
        setDescription(fresh?.description || '');
        setIsRepeatable(!!fresh?.is_repeatable);
        setIsShared(!!fresh?.is_shared);
        setIsAvailable(!!fresh?.is_available);
        setImagePreview(fresh?.preview_image_url || '');
        // If items are present in the fresh payload, hydrate itemsCount immediately
        if (Array.isArray(fresh?.items)) setItemsCount(fresh.items.length);
      } catch(_) {}
    }
    const key = `${initialQuiz?.id || ''}:${open ? '1' : '0'}`;
    if (fetchedQuizRef.current.id !== key && open) {
      fetchedQuizRef.current.id = key;
      refresh();
    }
    return () => { mounted = false; };
  }, [open, initialQuiz?.id, qapi]);

  useEffect(() => {
    let mounted = true;
    async function fetchCount() {
      if (!open || !initialQuiz?.id) return;
      try {
        setLoadingItems(true);
        const list = await iapi.list(initialQuiz.id);
        if (!mounted) return;
        setItemsCount(Array.isArray(list) ? list.length : 0);
      } catch (_) {
        // Do not overwrite existing count on error (e.g., student may not have access to list API)
      }
      finally { if (mounted) setLoadingItems(false); }
    }
    fetchCount();
    return () => { mounted = false; };
  }, [open, initialQuiz?.id, iapi]);

  useEffect(() => {
    let mounted = true;
    async function loadResults() {
      if (!showResults || !quiz?.id) return;
      try {
        setLoadingResults(true); setResultsError('');
        const seq = ++fetchSeqRef.current;
        let rows = [];
        try { rows = toArray(await gapi.listByQuiz(quiz.id)); }
        catch(_) { rows = toArray(await gapi.list()); }
        if (!mounted) return;
        if (seq !== fetchSeqRef.current) return; // stale
        const qid = Number(quiz.id);
        const filtered = rows.filter(r => {
          const a = r && (r.quiz_id ?? r.quizId ?? (r.quiz && (r.quiz.id || r.quiz.quiz_id)));
          const b = Number(a);
          return !Number.isNaN(b) ? b === qid : String(a || '') === String(quiz.id);
        });
        setResults(filtered);
      } catch(e) {
        if (mounted){
          setResults([]);
          const msg = e?.message || 'Failed to load results';
          setResultsError(msg);
          try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg } })); } catch(_) {}
        }
      }
      finally { if (mounted) setLoadingResults(false); }
    }
    loadResults();
    return () => { mounted = false; };
  }, [showResults, quiz?.id, gapi]);

  async function fetchResultsNow() {
    if (!quiz?.id) return;
    try {
      setLoadingResults(true); setResultsError('');
      try { console.log('[QUIZ RESULTS] fetching', { quizId: quiz?.id, isOwner, isTeacher, showResults }); } catch(_) {}
      const seq = ++fetchSeqRef.current;
      let rows = [];
      try { rows = toArray(await gapi.listByQuiz(quiz.id)); } catch(_) { rows = toArray(await gapi.list()); }
      const qid = Number(quiz.id);
      const filtered = rows.filter(r => {
        const a = r && (r.quiz_id ?? r.quizId ?? (r.quiz && (r.quiz.id || r.quiz.quiz_id)));
        const b = Number(a);
        return !Number.isNaN(b) ? b === qid : String(a || '') === String(quiz.id);
      });
      const finalRows = filtered;
      if (seq === fetchSeqRef.current) {
        setResults(finalRows);
        setResponseCount(finalRows.length);
      }
      try { console.log('[QUIZ RESULTS] loaded', { quizId: quiz?.id, rows: finalRows.length, responseCount: finalRows.length }); } catch(_) {}
    } catch (e) {
      setResults([]);
      const msg = e?.message || 'Failed to load results';
      setResultsError(msg);
      try { console.error('[QUIZ RESULTS] error', msg); } catch(_) {}
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg } })); } catch(_) {}
    } finally { setLoadingResults(false); }
  }

  useEffect(() => {
    let mounted = true;
    async function countResponses() {
      if (!open || !quiz?.id) return;
      try {
        let rows = [];
        try { rows = toArray(await gapi.listByQuiz(quiz.id)); } catch(_) { rows = toArray(await gapi.list()); }
        if (!mounted) return;
        const qid = Number(quiz.id);
        const filtered = rows.filter(r => {
          const a = r && (r.quiz_id ?? r.quizId ?? (r.quiz && (r.quiz.id || r.quiz.quiz_id)));
          const b = Number(a);
          return !Number.isNaN(b) ? b === qid : String(a || '') === String(quiz.id);
        });
        setResponseCount(filtered.length);
      } catch(_) { if (mounted) setResponseCount(0); }
    }
    countResponses();
    return () => { mounted = false; };
  }, [open, quiz?.id, gapi]);

  if (!open) return null;

  const isDraft = !quiz?.is_published && quiz?.status !== 'published';
  const ownerId = quiz?.creator_id ?? quiz?.creator?.id ?? quiz?.created_by_id ?? quiz?.owner_id ?? initialQuiz?.creator_id ?? initialQuiz?.creator?.id;
  const courseTeacherId = quiz?.course?.teacher?.id ?? quiz?.course?.teacher_id ?? quiz?.teacher_id ?? initialQuiz?.course?.teacher?.id ?? initialQuiz?.teacher_id;
  const meU = (user?.username || '').toString();
  const creatorU = (quiz?.creator?.username || quiz?.creator_username || quiz?.created_by || quiz?.author || initialQuiz?.creator?.username || initialQuiz?.creator_username || '').toString();
  const teacherU = (quiz?.teacher?.username || quiz?.teacher_username || quiz?.course?.teacher?.username || initialQuiz?.teacher?.username || initialQuiz?.course?.teacher?.username || '').toString();
  const isOwner = !!user && !!quiz && (
    (ownerId != null && String(user.id) === String(ownerId)) ||
    (courseTeacherId != null && String(user.id) === String(courseTeacherId)) ||
    (meU && creatorU && creatorU.toLowerCase() === meU.toLowerCase()) ||
    (meU && teacherU && teacherU.toLowerCase() === meU.toLowerCase())
  );
  // Owners (creator) or course teachers can configure regardless of role
  const readOnly = !isOwner;

  async function toggleAvailableNow() {
    if (!quiz?.id) return;
    try {
      const res = await qapi.toggle(quiz.id);
      setIsAvailable(!!res?.is_available);
      setQuiz(prev => ({ ...prev, ...res }));
      if (onUpdated) onUpdated({ ...quiz, ...res });
      try {
        if (res?.is_available) {
          window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Quiz is now available' } }));
        } else {
          window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: 'Quiz is set to unavailable' } }));
        }
      } catch(_) {}
    } catch(e) {
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e?.message || 'Failed to toggle availability' } })); } catch(_) {}
    }
  }

  async function replaceImageIfAny(qid) {
    if (!imageFile) return null;
    try {
      const res = await qapi.uploadPreview(qid, imageFile);
      const url = (res && (res.preview_image_url || res.url || res.preview || res.image_url || res.path || res.location)) || null;
      return url;
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Image upload failed' } })); } catch(_) {}
      return null;
    }
  }

  function bust(url) {
    if (!url) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}t=${Date.now()}`;
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const payload = {};
      if (isDraft) {
        payload.title = title.trim();
        payload.description = description.trim() || null;
      }
      payload.is_repeatable = !!isRepeatable;
      payload.is_available = !!isAvailable;
      if (!isTeacher) payload.is_shared = !!isShared;

      const updated = await qapi.update(quiz.id, payload);
      const newUrl = await replaceImageIfAny(quiz.id);
      const finalUrl = newUrl || updated.preview_image_url || quiz.preview_image_url || null;
      // refresh items count to ensure UI shows the latest
      let latestCount = itemsCount;
      try { const list = await iapi.list(quiz.id); latestCount = Array.isArray(list) ? list.length : (typeof latestCount==='number'? latestCount : 0); } catch(_) {}
      const merged = { ...updated, preview_image_url: finalUrl ? bust(finalUrl) : finalUrl, items_count: latestCount };
      setQuiz(merged);
      if (finalUrl) setImagePreview(bust(finalUrl));
      else if (imageFile) setImagePreview(prev => bust(prev));
      if (onUpdated) onUpdated(merged);
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Changes saved ✨' } })); } catch(_) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to save' } })); } catch(_) {}
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setSaving(true);
    try {
      if (!title.trim()) {
        try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: 'Please complete all required fields.' } })); } catch(_) {}
        return;
      }
      let count = itemsCount;
      if (count == null) {
        try { const list = await iapi.list(quiz.id); count = Array.isArray(list) ? list.length : 0; } catch(_) { count = 0; }
      }
      if ((count || 0) < 1) {
        try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: 'Please add at least one item before publishing.' } })); } catch(_) {}
        return;
      }
      const res = await qapi.publish(quiz.id);
      // ensure items_count is fresh after publish as well
      let latestCount = itemsCount;
      try { const list = await iapi.list(quiz.id); latestCount = Array.isArray(list) ? list.length : (typeof latestCount==='number'? latestCount : 0); } catch(_) {}
      const merged = { ...quiz, ...res, status: 'published', is_published: true, items_count: latestCount };
      setQuiz(merged);
      if (onPublished) onPublished(merged);
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Published 🎉' } })); } catch(_) {}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to publish' } })); } catch(_) {}
    } finally {
      setSaving(false);
    }
  }

  async function removeQuiz() {
    setConfirmDlg({
      open:true,
      message:'Delete this quiz and all of its items and attempts? This cannot be undone.',
      onYes: async () => {
        try {
          await qapi.remove(quiz.id);
          if (onDeleted) onDeleted(quiz.id);
          onClose();
          try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: 'Quiz deleted' } })); } catch(_) {}
        } catch (e) {
          try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: e.message || 'Failed to delete' } })); } catch(_) {}
        } finally {
          setConfirmDlg({ open:false, message:'', onYes:null });
        }
      }
    });
  }

  return (
    <>
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex: 70, overflowY:'auto', paddingTop:'clamp(24px, 15vh, 83px)', paddingBottom:'clamp(24px, 10vh, 96px)' }}>
      <style>{`
        .qd-font { font-family: 'Kodchasan', system-ui, sans-serif; }
        .qd-chip { font-family: 'Kodchasan', system-ui, sans-serif; font-size: 13px; padding: 5px 10px; border-radius: 999px; font-weight: 800; transition: transform .12s ease; display:inline-block }
        .qd-chip:hover { transform: translateY(-1px); }
        .qd-pill { font-family:'Kodchasan', system-ui, sans-serif; padding:6px 12px; border-radius:999px; font-weight:900; font-size:12px; }
        .qd-btn { --bg:#6a3ecb; --fg:#ffffff; font-family:'Kodchasan', system-ui, sans-serif; padding: 10px 14px; border-radius: 12px; border:2px solid var(--bg); background: var(--bg); color: var(--fg); font-weight: 900; transition: background .15s ease, color .15s ease, transform .12s ease, box-shadow .15s ease, border-color .15s ease; cursor:pointer }
        .qd-btn:hover { background: var(--fg); color: var(--bg); border-color: var(--bg); box-shadow: 0 12px 24px rgba(106,62,203,.22); transform: translateY(-2px); }
        .qd-btn-ghost { --bg:#6a3ecb; --fg:#6a3ecb; font-family:'Kodchasan', system-ui, sans-serif; padding: 10px 14px; border-radius:12px; border:2px solid var(--bg); background:#fff; color:var(--fg); font-weight:900; }
        .qd-icon-btn { width:40px; height:40px; border-radius:10px; border:2px solid #d32f2f; background:#fff; color:#d32f2f; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0; }
        .qd-input { padding:12px 14px; border-radius:16px; border:2px solid #1f163333; font-family:'Kodchasan', system-ui, sans-serif; }

        /* Compact hot-pink checkbox for Repeatable (36x36) */
        .qd-check .pink-input { appearance:none; -webkit-appearance:none; width:36px; height:36px; border-radius:10px; border:2px solid #dd2680; background:#dd2680; cursor:pointer; display:inline-block; position:relative; transition: transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease; }
        .qd-check .pink-input:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(221,38,128,.20); }
        .qd-check .pink-input:active { transform: scale(.98); }
        .qd-check .pink-input::after { content:""; position:absolute; left:11px; top:6px; width:8px; height:16px; border:4px solid #fff; border-top:0; border-left:0; transform: rotate(45deg); opacity:0; transition: opacity .12s ease; }
        .qd-check .pink-input:checked::after { opacity:1; }

        /* Lock toggle for Availability (36x36) */
        .qd-lock .lock-input { display: none; }
        .qd-lock .lock-label { width: 36px; height: 36px; display:flex; align-items:center; justify-content:center; background-color: rgb(80,80,80); border-radius: 12px; cursor: pointer; transition: all .3s; }
        .qd-lock .lock-wrapper { width: fit-content; height: fit-content; display:flex; flex-direction: column; align-items:center; justify-content:center; transform: rotate(-10deg); }
        .qd-lock .shackle { background-color: transparent; height: 7px; width: 11px; border-top-right-radius: 10px; border-top-left-radius: 10px; border-top: 2px solid white; border-left: 2px solid white; border-right: 2px solid white; transition: all .3s; }
        .qd-lock .lock-body { width: 12px; }
        .qd-lock .lock-input:checked + .lock-label .lock-wrapper .shackle { transform: rotateY(150deg) translateX(3px); transform-origin: right; }
        .qd-lock .lock-input:checked + .lock-label { background-color: rgb(167, 71, 245); }
        .qd-lock .lock-label:active { transform: scale(0.9); }

        /* Always-visible scrollbars for results area */
        .qd-scroll { scrollbar-gutter: stable both-edges; }
        .qd-scroll::-webkit-scrollbar { width: 12px; height: 12px; }
        .qd-scroll::-webkit-scrollbar-track { background: #efe9fb; border-radius: 10px; }
        .qd-scroll::-webkit-scrollbar-thumb { background: #b8a5f6; border-radius: 10px; border: 2px solid #efe9fb; }
        .qd-scroll::-webkit-scrollbar-thumb:hover { background: #9b85ef; }
        /* Firefox */
        .qd-scroll { scrollbar-width: thin; scrollbar-color: #b8a5f6 #efe9fb; }
      `}</style>
      <div className="qd-font" style={{ width: 'min(820px, 96vw)', background:'#fff', borderRadius: 18, overflow:'visible', boxShadow:'0 18px 48px rgba(0,0,0,0.22)', border:'3px solid #1f16331a', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding: 14, display:'flex', justifyContent:'space-between', alignItems:'center', background:'#dd2680', color:'#fff' }}>
          <div style={{ fontWeight: 900, fontSize:24 }}>{isDraft ? 'Draft Details' : 'Quiz Details'}</div>
          <button onClick={onClose}
            title="Close"
            style={{ width:40, height:40, borderRadius:12, border:'1px solid rgba(255,255,255,0.5)', background:'transparent', color:'#fff', fontSize:22, fontWeight:900, lineHeight:'22px', cursor:'pointer', boxShadow:'none', transition:'transform .12s ease, box-shadow .15s ease, background .12s ease, border-color .12s ease' }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(0,0,0,.25)'; e.currentTarget.style.background='rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.75)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='rgba(255,255,255,0.5)'; }}
          >×</button>
        </div>
        {/* Body */}
        <div style={{ padding: 16, display:'grid', gap: 12, overflowY:'auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'180px 1fr', gridTemplateRows:'auto auto', gap: 16, alignItems:'start' }}>
            {/* Image */}
            <div>
              <div style={{ width:'100%', height: 160, borderRadius: 12, border:'2px dashed #e6e0f4', background:'#faf7ff', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {imagePreview ? (<img alt="preview" src={imagePreview} style={{ width:'100%', height:'100%', objectFit:'cover' }} />) : (<div style={{ color:'#6a3ecb', fontWeight:800 }}>No image</div>)}
              </div>
            </div>
            {/* Title and meta */}
            <div style={{ display:'grid', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <div style={{ fontWeight:900, color:'#6a3ecb', fontSize:32 }}>{readOnly ? (quiz?.title || 'Untitled') : (title || 'Untitled')}</div>
                <span className="qd-pill" style={{ background:'#fff4e6', color:'#b26a00' }}>{isDraft?'Draft':'Published'}</span>
              </div>
              <div style={{ fontSize:19 }}>
                <strong>{!quiz?.course_id ? 'Creator' : 'Teacher'}:</strong>{' '}
                {(Number(ownerId) === Number(user?.id) || Number(courseTeacherId) === Number(user?.id))
                  ? (user?.username || 'You')
                  : (
                    quiz?.creator?.username || quiz?.creator_username || quiz?.teacher?.username || quiz?.teacher_username || quiz?.course?.teacher?.username || 'Unknown'
                  )}
              </div>
              {(() => { const effectiveCount = (typeof itemsCount === 'number') ? itemsCount : (Array.isArray(quiz?.items) ? quiz.items.length : undefined); return (
              <div style={{ display:'flex', gap:20, flexWrap:'wrap', fontSize:19 }}>
                <div style={{fontSize:19 }}><strong>Created:</strong> {quiz?.created_at ? new Date(quiz.created_at).toLocaleDateString() : '—'}</div>
                <div style={{fontSize:19 }}><strong>Published:</strong> {quiz?.is_published ? (quiz?.published_at ? new Date(quiz.published_at).toLocaleDateString() : (quiz?.updated_at ? new Date(quiz.updated_at).toLocaleDateString() : '—')) : '-'}</div>
                <div style={{fontSize:19 }}><strong>Items:</strong> {loadingItems ? '…' : (typeof effectiveCount === 'number' ? effectiveCount : '—')}</div>
              </div>
              ); })()}
              {readOnly ? (
                <>
                  <div style={{ fontSize:19 }}><strong>Repeatable:</strong> {isRepeatable ? 'Yes' : 'No'}</div>
                  <div style={{ fontSize:19 }}><strong>Available:</strong> {isAvailable ? 'Yes' : 'No'}</div>
                </>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:22, marginTop:6, marginBottom:14, flexWrap:'wrap' }}>
                  <label className="qd-check" style={{ display:'flex', alignItems:'center', gap:8, margin:0 }}>
                    <input
                      className="pink-input"
                      type="checkbox"
                      checked={!!isRepeatable}
                      onChange={async (e)=>{
                        const val = !!e.target.checked;
                        setIsRepeatable(val);
                        try {
                          const updated = await qapi.update(quiz.id, { is_repeatable: val });
                          setQuiz(prev => ({ ...prev, ...updated }));
                          if (onUpdated) onUpdated({ ...quiz, ...updated });
                          try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: `Repeatable ${val ? 'enabled' : 'disabled'}` } })); } catch(_) {}
                        } catch(err) {
                          setIsRepeatable(prev => !val); // revert
                          try { window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: err?.message || 'Failed to update repeatable' } })); } catch(_) {}
                        }
                      }}
                    />
                    <span>Repeatable</span>
                  </label>
                  <div className="qd-lock" style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input type="checkbox" id={`availLock-${quiz?.id || 'x'}`} className="lock-input" checked={!!isAvailable} onChange={toggleAvailableNow} />
                    <label htmlFor={`availLock-${quiz?.id || 'x'}`} className="lock-label">
                      <span className="lock-wrapper">
                        <span className="shackle"></span>
                        <svg className="lock-body" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M0 5C0 2.23858 2.23858 0 5 0H23C25.7614 0 28 2.23858 28 5V23C28 25.7614 25.7614 28 23 28H5C2.23858 28 0 25.7614 0 23V5ZM16 13.2361C16.6137 12.6868 17 11.8885 17 11C17 9.34315 15.6569 8 14 8C12.3431 8 11 9.34315 11 11C11 11.8885 11.3863 12.6868 12 13.2361V18C12 19.1046 12.8954 20 14 20C15.1046 20 16 19.1046 16 18V13.2361Z" fill="white"/>
                        </svg>
                      </span>
                    </label>
                    <span>{isAvailable ? 'Available' : 'Unavailable'}</span>
                  </div>
                </div>
              )}
            </div>
            {/* Row 2 buttons: left under image, right under meta */}
            {!readOnly && (
              <>
                <div style={{ display:'flex', justifyContent:'flex-start' }}>
                  <label className="qd-btn" style={{ '--bg':'#6a3ecb', '--fg':'#fff', padding:'10px 16px', cursor:'pointer', marginLeft:17 }}
                    onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(106,62,203,.22)'; }}
                    onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
                  >
                    <input type="file" accept="image/*" onChange={e=>{ const f=e.target.files && e.target.files[0]; setImageFile(f||null); if (f){ setImagePreview(URL.createObjectURL(f)); } }} style={{ display:'none' }} />
                    Choose image
                  </label>
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <button className="qd-btn" onClick={()=> onManage ? onManage(quiz.id) : null} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px' }}
                    onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(106,62,203,.22)'; }}
                    onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
                  >
                    {/* Edit/Pencil icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                    Manage Content
                  </button>
                </div>
              </>
            )}
          </div>
          {/* Title/Description */}
          {readOnly ? (
            <>
              <div style={{ whiteSpace:'pre-wrap', padding:'12px 14px', borderRadius:16, border:'2px solid #1f163333', minHeight:64, fontFamily:'Kodchasan, system-ui, sans-serif', fontSize:20 }}>{quiz?.description || '—'}</div>
              {quiz?.is_published && quiz?.is_available && (
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <button className="qd-btn" onClick={()=> onTake && onTake(quiz.id)} style={{ '--bg':'#6a3ecb', '--fg':'#fff', padding:'10px 16px',fontSize:20 }}
                    onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(106,62,203,.22)'; }}
                    onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
                  >Take Quiz</button>
                </div>
              )}
            </>
          ) : (
            <>
              <input className="qd-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Quiz Title" />
              <textarea className="qd-input" rows={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Type in the quiz description here." />
            </>
          )}
          {/* Footer */}
          {!readOnly && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8, flexWrap:'wrap', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <button className="qd-icon-btn" title="Delete" onClick={removeQuiz}
                  onMouseEnter={e=>{ e.currentTarget.style.background='#d32f2f'; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='0 10px 22px rgba(0,0,0,0.16)'; e.currentTarget.style.transform='translateY(-1px)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#d32f2f'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <button
                  className="qd-btn-ghost"
                  onClick={()=>{ setShowResults(v => { const next = !v; if (next && (!Array.isArray(results) || results.length===0)) { fetchResultsNow(); } return next; }); }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; }}
                  style={{ padding:'10px 16px', borderColor:'#6a3ecb', color:'#6a3ecb' }}
                >
                  {(() => {
                    const isPersonal = !((quiz?.course_id ?? quiz?.course?.id));
                    const base = showResults ? 'Hide Details' : (isPersonal ? 'View Quiz Details' : 'View Grade Details');
                    const count = (typeof responseCount==='number'?responseCount:'…');
                    return `${base} (${count})`;
                  })()}
                </button>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <button className="qd-btn" onClick={saveChanges} disabled={saving} style={{ '--bg':'#fcb00d', '--fg':'#000', padding:'10px 16px', borderColor:'#000' }}
                  onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(0,0,0,.22)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
                >{saving ? 'Saving…' : 'Save Changes'}</button>
                <button
                  className="qd-btn-ghost"
                  onClick={publish}
                  disabled={!!quiz?.is_published || quiz?.status === 'published'}
                  style={{ padding:'10px 16px', opacity: (!!quiz?.is_published || quiz?.status==='published') ? 0.6 : 1, cursor: (!!quiz?.is_published || quiz?.status==='published') ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e=>{
                    if (!!quiz?.is_published || quiz?.status==='published') return;
                    e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='0 12px 24px rgba(106,62,203,.22)'; e.currentTarget.style.transform='translateY(-2px)';
                  }}
                  onMouseLeave={e=>{
                    if (!!quiz?.is_published || quiz?.status==='published') return;
                    e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none';
                  }}
                >Publish</button>
              </div>
            </div>
          )}

          {showResults && (
            <div style={{ marginTop: 10, border:'1px solid #eee', borderRadius: 10, overflow:'hidden' }}>
              <div style={{ padding: 10, background:'#f7f3ff', color:'#6a3ecb', fontWeight:900 }}>Quiz Results</div>
              <div style={{ padding: 10 }}>
                {resultsError && (
                  <div style={{ background:'#fdecea', color:'#611a15', padding:8, borderRadius:8, marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <span>{resultsError}</span>
                    <button onClick={fetchResultsNow} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e6e0f4', background:'#fff', fontWeight:800 }}>Retry</button>
                  </div>
                )}
                <div style={{ marginBottom:8, fontWeight:800, color:'#6a3ecb' }}>Total responses: {typeof responseCount==='number'? responseCount : (Array.isArray(results)?results.length:0)}</div>
                {(Array.isArray(results) && results.length > 0) ? (
                  <table style={{ width:'100%', background:'#fff', borderCollapse:'collapse', border:'1px solid #e6e0f4', borderRadius:8 }}>
                      <thead>
                        <tr style={{ textAlign:'left', background:'#faf7ff', position:'sticky', top:0, zIndex:1 }}>
                          {(isOwner || isTeacher) && <th style={{ padding:8, borderBottom:'1px solid #e6e0f4', background:'#faf7ff' }}>Student</th>}
                          <th style={{ padding:8, borderBottom:'1px solid #e6e0f4', background:'#faf7ff' }}>Score</th>
                          <th style={{ padding:8, borderBottom:'1px solid #e6e0f4', background:'#faf7ff' }}>Percentage</th>
                          <th style={{ padding:8, borderBottom:'1px solid #e6e0f4', background:'#faf7ff' }}>Date</th>
                          {(isOwner || isTeacher) && <th style={{ padding:8, borderBottom:'1px solid #e6e0f4', background:'#faf7ff' }}>Attempts</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const safe = Array.isArray(results) ? results : [];
                          const counts = {};
                          for (const r of safe) {
                            const k = String(r.user_id ?? r.student_id ?? r.student_username ?? r.username ?? r.student_name ?? r.email ?? '');
                            counts[k] = (counts[k] || 0) + 1;
                          }
                          return safe.map((r, i) => {
                            const total = Number(r.total_items ?? r.total ?? 0) || 0;
                            const score = Number(r.score ?? 0) || 0;
                            const pct = total > 0 ? Math.round((score / total) * 100) : 0;
                            let dateTxt = '-';
                            try { dateTxt = r.created_at ? new Date(r.created_at).toLocaleString() : (r.updated_at ? new Date(r.updated_at).toLocaleString() : '-'); } catch(_) {}
                            const k = String(r.user_id ?? r.student_id ?? r.student_username ?? r.username ?? r.student_name ?? r.email ?? '');
                            return (
                              <tr key={r.attempt_id ?? `row-${i}`} style={{ borderBottom:'1px solid #f0eef8' }}>
                                {(isOwner || isTeacher) && <td style={{ padding:8, borderRight:'1px solid #f6f3ff' }}>{r.student_name || r.student_username || r.username || '—'}</td>}
                                <td style={{ padding:8, borderRight:'1px solid #f6f3ff' }}>{score}/{total}</td>
                                <td style={{ padding:8, borderRight:'1px solid #f6f3ff' }}>{pct}%</td>
                                <td style={{ padding:8, borderRight:'1px solid #f6f3ff' }}>{dateTxt}</td>
                                {(isOwner || isTeacher) && <td style={{ padding:8 }}>{counts[k] || 1}</td>}
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                  </table>
                ) : (loadingResults ? <div>Loading…</div> : <div style={{ opacity:0.75 }}>No results yet.</div>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {confirmDlg.open && (
      <div className="qd-font" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.28)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:120 }}>
        <div style={{ width:420, maxWidth:'92vw', background:'#fff', borderRadius:16, boxShadow:'0 18px 44px rgba(0,0,0,.22)', overflow:'hidden' }}>
          <div style={{ background:'#dd2680', color:'#fff', fontWeight:900, padding:'10px 14px' }}>QuizDeck</div>
          <div style={{ padding:16, fontSize:16 }}>{confirmDlg.message}</div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:16 }}>
            <button
              className="qd-btn-ghost"
              onClick={() => setConfirmDlg({ open:false, message:'', onYes:null })}
              style={{ padding:'10px 14px', border:'2px solid #6a3ecb', background:'#fff', color:'#6a3ecb', fontWeight:900, borderRadius:12, transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease, border-color .12s ease' }}
              onMouseEnter={e=>{ e.currentTarget.style.background='#6a3ecb'; e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 24px rgba(106,62,203,.22)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#6a3ecb'; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}
            >Cancel</button>
            <button
              onClick={() => { const fn=confirmDlg.onYes; if (fn) fn(); }}
              style={{ padding:'10px 14px', borderRadius:12, border:'2px solid #d9254f', background:'#d9254f', color:'#fff', fontWeight:900, transition:'transform .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease, border-color .12s ease' }}
              onMouseEnter={e=>{ e.currentTarget.style.background='#fff'; e.currentTarget.style.color='#d9254f'; e.currentTarget.style.boxShadow='0 12px 24px rgba(217,37,79,.22)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background='#d9254f'; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow='none'; }}
            >Delete</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
