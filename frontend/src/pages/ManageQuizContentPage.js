import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { quizzesApi, quizItemsApi } from '../hooks/quizzes';
import PreviewQuizModal from '../components/quizzes/PreviewQuizModal';
import Header from '../Header';
import SidebarLeft from '../SidebarLeft';
import SidebarRight from '../SidebarRight';
import { CustomThemeProvider, mainContentStyles, overlayStyles, theme } from '../theme';
import { API_BASE } from '../api';
import { Box, Typography, IconButton, MenuItem, Select, Tooltip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';

export default function ManageQuizContentPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const qapi = useMemo(() => quizzesApi(token), [token]);
  const iapi = useMemo(() => quizItemsApi(token), [token]);
  const [quiz, setQuiz] = useState(null);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState({}); // { [itemId]: { question, type, choices: [{id,choice_text,is_correct}], correct_answer } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAnswers, setShowAnswers] = useState(true);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragHoverIdx, setDragHoverIdx] = useState(null);
  const [dragInsertAt, setDragInsertAt] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [navMode, setNavMode] = useState('both'); // 'both' | 'forward'
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [newType, setNewType] = useState('identification');
  const fileInputsRef = useRef({});
  const orderIdsRef = useRef({}); // { [itemId]: string[] } stable ids per step for keys
  const dragRaf = useRef(0);
  const [undoInfo, setUndoInfo] = useState(null); // { itemId, order }
  const undoTimerRef = useRef(0);
  const [confirmDlg, setConfirmDlg] = useState({ open:false, message:'', onYes:null });
  const switchCss = `
  .qd-invert { transition: all .18s ease; }
  .qd-invert:hover { background: var(--btn-hover-bg, var(--btn-fg)) !important; color: var(--btn-hover-fg, var(--btn-bg)) !important; border-color: var(--btn-hover-border, var(--btn-fg)) !important; filter: saturate(1.05); }

  /* Buttons: base shadow + hover like Show/Hide toggle */
  .qd-btn-anim { box-shadow: 0 10px 22px rgba(0,0,0,0.12); transition: box-shadow .18s ease, transform .18s ease, filter .18s ease; }
  .qd-btn-anim:hover { box-shadow: 0 18px 36px rgba(0,0,0,0.2); transform: translateY(-1px); }
  .qd-icon { box-shadow: 0 10px 22px rgba(0,0,0,0.12) !important; border-radius: 12px; }
  .qd-icon:hover { box-shadow: 0 18px 36px rgba(0,0,0,0.2) !important; }

  .theme-switch { display:flex; flex-direction:row; align-items:center; justify-content:center; cursor:pointer; width: 12em; height: 2.8em; font-size: 16px; font-family: Montserrat, system-ui, sans-serif; font-weight: 800; color:#6a3ecb; background-color:#f7e7ff; padding:.5em; border:1px solid #6a3ecb; box-shadow: 6px 6px 0px #6a3ecb33; transition:.3s; position:relative; border-radius:12px; }
  .theme-switch .name::before { color:#6a3ecb; content:"Bidirectional"; margin-right: 1.2em; transition:.2s ease-in-out; }
  .theme-switch .name::after { color:#dd2680; content:"Forward Only"; margin-right: .8em; transition:.2s ease-in-out; display:none; }
  .theme-switch .slider { position:absolute; background-color:#6a3ecb; right:.65em; width:26px; height:26px; border-radius:50%; border:4px solid #6a3ecb; transform: rotate(-120deg); box-shadow: inset 0px 6px #e0d5ff, inset 0px 6px 1px 1px #e0d5ff; }
  .theme-switch .back { position:absolute; inset:0; border-radius:12px; pointer-events:none; }
  .theme-switch:hover { color:#fff; box-shadow:none; transform: translateX(6px) translateY(6px); background-color:#dd2680; border-color:#dd2680; }

  /* Global font & tooltip sizing */
  body, button, input, select, textarea, .MuiTooltip-tooltip { font-family: 'Kodchasan', system-ui, sans-serif !important; }
  .MuiTooltip-tooltip { font-size: 16px; padding: 12px 14px; }

  .theme-switch:hover .name::before, .theme-switch:hover .name::after { color:#fff; }
  .theme-switch input[type=checkbox]:checked + .slider { transform: rotate(360deg); box-shadow:none; border:4px solid #dd2680; background-color:#dd2680; }
  .theme-switch input[type=checkbox]:checked ~ .name::before { display:none; }
  .theme-switch input[type=checkbox]:checked ~ .name::after { display:block; }
  .theme-switch input[type=checkbox] { position:absolute; visibility:hidden; }
  .slider { transition: 300ms ease; }
  `;

  function toAbsoluteUrl(p) {
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    const base = API_BASE;
    const path = p.startsWith('/') ? p : `/${p}`;
    return `${base}${path}`;
  }
  async function saveOrderingImmediately(item, edDraft, newOrder) {
    try {
      const payload = { question: (edDraft?.question ?? item.question), type: 'ordering', meta: { order: newOrder } };
      const updated = await iapi.update(item.id, payload);
      setItems(prev => prev.map(x => x.id === item.id ? updated : x));
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('toast', { detail: { type:'error', message:"Couldn't save ordering. Changes kept locally." } })); } catch(_) {}
    }
  }
  function showUndo(itemId, prevOrder) {
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = 0; }
    setUndoInfo({ itemId, order: [...prevOrder] });
    undoTimerRef.current = setTimeout(() => { setUndoInfo(null); undoTimerRef.current = 0; }, 6000);
  }
  async function handleUndo() {
    if (!undoInfo) return;
    const { itemId, order } = undoInfo;
    const item = items.find(x => x.id === itemId);
    const ed = editing[itemId] || { ...(item||{}), meta: item?.meta || {} };
    changeEdit(itemId, { meta: { ...(ed.meta||{}), order: [...order] } });
    await saveOrderingImmediately(item, ed, order);
    setUndoInfo(null);
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = 0; }
  }

  function moveOrder(ed, i, dir) {
    const order = Array.isArray(ed.meta?.order) ? [...ed.meta.order] : [];
    const ni = i + dir;
    if (ni < 0 || ni >= order.length) return order;
    const t = order[i]; order[i] = order[ni]; order[ni] = t; return order;
  }
  async function onUploadMedia(item, file) {
    if (!file) return;
    try {
      const res = await iapi.uploadMedia(item.id, file, token);
      const abs = res?.media_url || toAbsoluteUrl(res?.media_path || res?.url || res?.location || res?.path || '');
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, media_path: abs, media_url: abs, media_type: res?.media_type || x.media_type } : x));
    } catch (e) { alert(e.message || 'Upload failed'); }
  }
  async function onDeleteMedia(item) {
    try {
      await iapi.deleteMedia(item.id);
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, media_path: null, media_url: null, media_type: null } : x));
    } catch (e) { alert(e.message || 'Failed'); }
  }
  function bust(url){
    if (!url) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}t=${Date.now()}`;
  }

  const load = useCallback(async () => {
    let mounted = true;
    try {
      setError('');
      setLoading(true);
      const [q, its] = await Promise.all([
        qapi.get(id),
        iapi.list(id),
      ]);
      if (!mounted) return;
      setQuiz(q);
      setItems(its || []);
    } catch (e) {
      console.error('ManageQuizContentPage load error:', e);
      setError(e?.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
    return () => { mounted = false; };
  }, [id, qapi, iapi]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    // hydrate nav mode from localStorage
    const key = `quiz_nav_mode_${id}`;
    const saved = (typeof window !== 'undefined') ? (localStorage.getItem(key) || 'both') : 'both';
    setNavMode(saved === 'forward' ? 'forward' : 'both');
  }, [id]);
  const toggleNavMode = () => {
    const next = navMode === 'forward' ? 'both' : 'forward';
    setNavMode(next);
    try { localStorage.setItem(`quiz_nav_mode_${id}`, next); } catch(_) {}
  };

  // Autosave every 10s for draft quizzes and on unload
  useEffect(() => {
    if (!quiz) return;
    if (quiz.is_published || quiz.status === 'published') return;
    let timer = setInterval(async () => {
      try {
        setSaving(true);
        await qapi.autosave(id, { title: quiz.title, description: quiz.description, is_repeatable: quiz.is_repeatable, is_shared: quiz.is_shared, is_available: quiz.is_available });
      } catch (e) {
        try { window.dispatchEvent(new CustomEvent('toast', { detail: { type:'error', message:"⚠️ Couldn't save changes. Retrying…" } })); } catch(_) {}
      } finally {
        setSaving(false);
      }
    }, 10000);
    const onUnload = () => {
      try {
        if (typeof navigator.sendBeacon === 'function') {
          // noop placeholder; could send a lightweight beacon if needed
        }
      } catch(_) {}
    };
    window.addEventListener('beforeunload', onUnload);
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', onUnload); };
  }, [qapi, id, quiz]);

  async function addItem(type) {
    try {
      const placeholder = 'Untitled question';
      const created = await iapi.create({ quiz_id: Number(id), type, question: placeholder });
      setItems(prev => [...prev, created]);
      // Immediately open in edit so the user can change the question in a text field
      beginEdit(created);
    } catch (e) { alert(e.message || 'Failed'); }
  }

  function beginEdit(item) {
    setEditing(prev => ({
      ...prev,
      [item.id]: {
        question: item.question,
        type: item.type,
        correct_answer: item.correct_answer || '',
        choices: Array.isArray(item.choices) ? item.choices.map(c => ({ id: c.id, choice_text: c.choice_text, is_correct: !!c.is_correct })) : [],
        // basic meta passthrough for matching/ordering
        meta: item.meta || {},
        // normalize for true/false convenience
        tf_correct: (function(){
          const t = (item.choices||[]).find(c=>String(c.choice_text).toLowerCase()==='true');
          const f = (item.choices||[]).find(c=>String(c.choice_text).toLowerCase()==='false');
          if (t||f) return !!(t&&t.is_correct);
          if (typeof item.correct_answer==='string') return item.correct_answer.toLowerCase()==='true';
          return false;
        })()
      }
    }));
  }
  function changeEdit(itemId, patch) { setEditing(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } })); }
  function onTypeChange(itemId, current, nextType) {
    const draft = { ...(current || {}), type: nextType };
    if (nextType === 'ordering') {
      const order = Array.isArray(draft?.meta?.order) && draft.meta.order.length ? draft.meta.order : ['', ''];
      draft.meta = { ...(draft.meta||{}), order };
      draft.choices = [];
    } else if (nextType === 'matching') {
      const pairs = Array.isArray(draft?.meta?.pairs) && draft.meta.pairs.length ? draft.meta.pairs : [{ left:'', right:'' }];
      draft.meta = { ...(draft.meta||{}), pairs };
      draft.choices = [];
    } else if (nextType === 'multiple_choice' || nextType === 'multiple_answer') {
      const base = Array.isArray(draft.choices) && draft.choices.length ? draft.choices : [
        { id:null, choice_text:'', is_correct:false },
        { id:null, choice_text:'', is_correct:false },
      ];
      draft.choices = base;
      draft.meta = draft.meta || {};
    } else if (nextType === 'true_false') {
      draft.tf_correct = !!draft.tf_correct;
      draft.choices = [];
      draft.meta = draft.meta || {};
    } else if (nextType === 'identification') {
      draft.correct_answer = draft.correct_answer || '';
      draft.choices = [];
      draft.meta = draft.meta || {};
    }
    changeEdit(itemId, draft);
  }
  function addChoice(itemId) {
    const draft = editing[itemId] || {}; const list = draft.choices || [];
    changeEdit(itemId, { choices: [...list, { id: null, choice_text: '', is_correct: false }] });
  }
  function removeChoice(itemId, idx) {
    const draft = editing[itemId] || {}; const list = draft.choices || [];
    changeEdit(itemId, { choices: list.filter((_, i) => i !== idx) });
  }
  async function saveEdit(item) {
    const draft = editing[item.id]; if (!draft) return;
    const doSave = async () => {
      try {
        const payload = { question: draft.question, type: draft.type };
        if (draft.type === 'identification') {
          payload.correct_answer = draft.correct_answer;
        } else if (draft.type === 'multiple_choice') {
          payload.choices = (draft.choices||[]).map(c => ({ id: c.id || undefined, choice_text: c.choice_text, is_correct: !!c.is_correct }));
        } else if (draft.type === 'multiple_answer') {
          payload.choices = (draft.choices||[]).map(c => ({ id: c.id || undefined, choice_text: c.choice_text, is_correct: !!c.is_correct }));
        } else if (draft.type === 'true_false') {
          const isTrue = !!draft.tf_correct;
          payload.choices = [
            { choice_text: 'True', is_correct: isTrue },
            { choice_text: 'False', is_correct: !isTrue }
          ];
          payload.correct_answer = isTrue ? 'True' : 'False';
        } else if (draft.type === 'matching') {
          payload.meta = { pairs: Array.isArray(draft.meta?.pairs) ? draft.meta.pairs : [] };
        } else if (draft.type === 'ordering') {
          payload.meta = { order: Array.isArray(draft.meta?.order) ? draft.meta.order : [] };
        }
        const updated = await iapi.update(item.id, payload);
        setItems(prev => prev.map(x => x.id === item.id ? updated : x));
        setEditing(prev => { const cp = { ...prev }; delete cp[item.id]; return cp; });
      } catch (e) { try { window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'error', message: e.message || 'Failed to save' } })); } catch(_) {} }
    };
    if (quiz?.is_published) {
      setConfirmDlg({ open:true, message:'This quiz is already published. Save changes anyway?', onYes: async ()=>{ await doSave(); setConfirmDlg({ open:false, message:'', onYes:null }); } });
      return;
    }
    await doSave();
  }

  async function removeItem(item) {
    setConfirmDlg({
      open:true,
      message:'Delete this item?',
      onYes: async () => {
        try {
          await iapi.remove(item.id);
          setItems(prev => prev.filter(x => x.id !== item.id));
          try { window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'success', message:'Item deleted' } })); } catch(_) {}
        } catch (e) { try { window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'error', message: e.message || 'Failed' } })); } catch(_) {} }
        finally { setConfirmDlg({ open:false, message:'', onYes:null }); }
      }
    });
  }

  async function onUploadImage(item, file) {
    if (!file) return;
    try {
      const res = await iapi.uploadImage(item.id, file, token);
      const abs = res?.image_url || toAbsoluteUrl(res?.image_path || res?.url || res?.location || res?.path || '');
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, image_path: abs, image_url: bust(abs) } : x));
    } catch (e) { alert(e.message || 'Upload failed'); }
  }
  async function onDeleteImage(item) {
    try {
      await iapi.deleteImage(item.id);
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, image_path: null, image_url: null } : x));
    } catch (e) { alert(e.message || 'Failed'); }
  }

  async function publish() {
    try { await qapi.publish(id); try { window.dispatchEvent(new CustomEvent('toast', { detail: { type:'success', message:'Published 🎉' } })); } catch(_) {} } catch (e) { try { window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'error', message: e.message || 'Failed' } })); } catch(_) {} }
  }

  async function removeQuiz() {
    setConfirmDlg({
      open:true,
      message:'Delete this quiz and all of its items and attempts? This cannot be undone.',
      onYes: async () => {
        try {
          await qapi.remove(id);
          try { window.dispatchEvent(new CustomEvent('toast', { detail: { type:'success', message:'Quiz deleted' } })); } catch(_) {}
          navigate('/quizzes');
        } catch (e) {
          try { window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'error', message: e.message || 'Failed to delete quiz' } })); } catch(_) {}
        } finally { setConfirmDlg({ open:false, message:'', onYes:null }); }
      }
    });
  }

  const ErrorPanel = error ? (
    <div style={{ background: '#fdecea', color: '#611a15', padding: 12, borderRadius: 8, marginBottom: 12, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
      <span>{error}</span>
      <button className="qd-btn-anim" onClick={load} style={{ padding:'8px 12px', borderRadius:10, border:'1px solid #e6e0f4', background:'#fff' }}>Retry</button>
    </div>
  ) : null;

  return (
    <CustomThemeProvider>
      <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'#d5ceed' }}>
        <Header isDashboard={true} isLeftOpen={isLeftOpen} isRightOpen={isRightOpen} toggleLeft={() => setIsLeftOpen(p=>!p)} toggleRight={() => setIsRightOpen(p=>!p)} />
        <div style={{ position:'relative', flexGrow:1 }}>
          <SidebarLeft isOpen={isLeftOpen} />
          <div style={mainContentStyles.base}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <IconButton aria-label="Back" onClick={() => navigate(-1)} sx={{ color: theme.palette.secondary.main }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.secondary.main }}>Back</Typography>
            </Box>
            <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:16, boxShadow:'0 12px 28px rgba(106,62,203,0.15)', padding:16 }}>
              <style>{switchCss}</style>
              {ErrorPanel}
              {loading ? (
                <div className="loader-container">
                  <div className="loader"></div>
                  <div className="loader-text">Loading...</div>
                </div>
              ) : (!quiz ? (
                <div style={{ background:'#fff', border:'1px solid #eee', borderRadius:12, padding:16 }}>
                  <div style={{ fontWeight:800, marginBottom:8 }}>Quiz not found</div>
                  <button className="qd-btn-anim" onClick={load} style={{ padding:'8px 12px', borderRadius:10, border:'1px solid #e6e0f4', background:'#fff' }}>Retry</button>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap', marginBottom:16 }}>
                    <div style={{ display:'grid', flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:'Kodchasan, system-ui', fontWeight:900, fontSize:32, color:'#3e2a6d', lineHeight:1.1, wordBreak:'break-word', overflowWrap:'anywhere' }}>Manage Quiz</div>
                      <div style={{ opacity:.85, fontSize:18, wordBreak:'break-word', overflowWrap:'anywhere', whiteSpace:'pre-wrap' }}>{quiz?.title} {saving && <span style={{ fontSize:13, opacity:.7 }}>(autosaving…)</span>}</div>
                      {quiz?.description ? (
                        <div style={{ opacity:.85, fontSize:16, lineHeight:1.55, marginTop:6, maxHeight:160, overflowY:'auto', wordBreak:'break-word', overflowWrap:'anywhere', whiteSpace:'pre-wrap' }}>
                          {quiz.description}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginLeft:'auto' }}>
                      <Tooltip title="Preview quiz"><span>
                        <button className="qd-btn-anim qd-invert" onClick={() => setShowPreview(true)} style={{ '--btn-bg':'#ffffff', '--btn-fg':'#dd2680', '--btn-hover-bg':'#dd2680', '--btn-hover-fg':'#ffffff', padding:'12px 16px', borderRadius:14, border:'2px solid #dd2680', background:'#fff0f6', color:'#dd2680', fontWeight:900, fontSize:16, display:'inline-flex', alignItems:'center', gap:8 }}>
                          <SearchOutlinedIcon sx={{ color:'currentColor' }} /> Preview
                        </button>
                      </span></Tooltip>
                      <Tooltip title="Publish quiz">
                        <button className="qd-btn-anim qd-invert" onClick={publish} style={{ '--btn-bg':'#ffae0c', '--btn-fg':'#3e2a6d', '--btn-hover-bg':'#ffae0c', '--btn-hover-fg':'#3e2a6d', padding:'12px 16px', borderRadius:14, border:'2px solid #ffae0c', background:'#fff5cf', color:'#ffae0c', fontWeight:900, boxShadow:'0 12px 26px rgba(255,174,12,0.18)', fontSize:16, display:'inline-flex', alignItems:'center', gap:8 }}>
                          <RocketLaunchOutlinedIcon sx={{ color:'currentColor' }} /> Publish
                        </button>
                      </Tooltip>
                      <Tooltip title="Delete quiz"><span>
                        <button className="qd-btn-anim qd-invert" onClick={removeQuiz} style={{ '--btn-hover-bg':'#d9254f', '--btn-hover-fg':'#ffffff', display:'inline-flex', alignItems:'center', gap:8, padding:'12px 16px', borderRadius:14, border:'2px solid #d9254f', background:'#ffe6ea', color:'#d9254f', fontWeight:900, fontSize:16 }}>
                          <DeleteOutlineIcon sx={{ color:'currentColor' }} /> Delete
                        </button>
                      </span></Tooltip>
                    </div>
                  
                  <div style={{ height:1, background:'linear-gradient(90deg, rgba(214,199,255,0.0), rgba(214,199,255,0.9), rgba(214,199,255,0.0))', margin:'12px 0 18px 0' }} />
                  </div>
                  <hr style={{ border: '2px solid #ffffffff', margin: '23px 20px' }} />

                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:16, wordBreak:'break-word' }}>
                      <Select size="medium" value={newType} onChange={(e)=>setNewType(e.target.value)} sx={{ minWidth:260, fontWeight:900, borderRadius:2, background:'#fff9e6' }}>
                      <MenuItem value="identification">Identification</MenuItem>
                      <MenuItem value="multiple_choice">Multiple Choice</MenuItem>
                      <MenuItem value="multiple_answer">Multiple Answer</MenuItem>
                      <MenuItem value="true_false">True/False</MenuItem>
                      <MenuItem value="matching">Matching</MenuItem>
                      <MenuItem value="ordering">Ordering</MenuItem>
                      </Select>
                      <button className="qd-btn-anim qd-invert" onClick={()=>addItem(newType)} style={{ '--btn-bg':'#fff4cc', '--btn-fg':'#b26a00', '--btn-hover-bg':'#ffae0c', '--btn-hover-fg':'#3e2a6d', display:'inline-flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:14, border:'2px solid #ffe08a', background:'#fff4cc', color:'#b26a00', fontWeight:900, fontSize:16 }}>
                      <AddCircleOutlineIcon sx={{ color:'#b26a00' }} /> Add Item
                      </button>
                    <Tooltip title={showAnswers ? 'Hide answers' : 'Show answers'}>
                      <IconButton className="qd-icon" onClick={()=>setShowAnswers(v=>!v)} sx={{ color:'#6a3ecb', border:'2px solid #6a3ecb', background:'#f7f2ff', '&:hover':{ background:'#6a3ecb', color:'#ffffff' } }}>
                        {showAnswers ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={navMode === 'forward' ? 'Forward Only' : 'Bidirectional'}>
                      <IconButton className="qd-icon" onClick={toggleNavMode} sx={{ color:'#6a3ecb', border:'2px solid #6a3ecb', background:'#f7f2ff', '&:hover':{ background:'#6a3ecb', color:'#ffffff' } }}>
                        {navMode === 'forward' ? <ArrowForwardIosIcon sx={{ color:'currentColor' }} /> : <SwapHorizIcon sx={{ color:'currentColor' }} />}
                      </IconButton>
                    </Tooltip>
                  </div>

                  {showAnswers && Array.isArray(items) && items.length>0 && (
                    <div style={{ background:'#fff9e6', border:'1px solid #ffeeba', borderRadius:14, padding:'12px 14px', marginBottom:16 }}>
                      <div style={{ fontWeight:900, color:'#b26a00', marginBottom:8, fontSize:18 }}>Answers Summary</div>
                      <div style={{ display:'grid', gap:6 }}>
                        {items.map((it, idx) => (
                          <div key={`sum-${it.id}`} style={{ display:'grid', gap:2 }}>
                            <div style={{ display:'flex', gap:8, alignItems:'baseline' }}>
                              <div style={{ width:26, textAlign:'right', fontWeight:900, color:'#b26a00' }}>{idx+1}.</div>
                              <div style={{ fontWeight:800, flex:1, minWidth:0, wordBreak:'break-word', overflowWrap:'anywhere', fontSize:16 }}>{it.question}</div>
                              <span style={{ background:'#fff2cc', color:'#b26a00', padding:'4px 10px', borderRadius:999, fontSize:13, fontWeight:900, textTransform:'capitalize', border:'1px solid #ffe08a' }}>{it.type.replace('_',' ')}</span>
                            </div>
                            <div style={{ paddingLeft:34, opacity:.9, wordBreak:'break-word', overflowWrap:'anywhere', fontSize:15 }}>
                              {(() => {
                                if (it.type === 'identification') return `Answer: ${it.correct_answer || ''}`;
                                if (it.type === 'true_false') {
                                  const t = (it.choices||[]).find(c=>String(c.choice_text).toLowerCase()==='true');
                                  const f = (it.choices||[]).find(c=>String(c.choice_text).toLowerCase()==='false');
                                  if (t && t.is_correct) return 'Answer: True'; if (f && f.is_correct) return 'Answer: False';
                                  return `Answer: ${it.correct_answer || ''}`;
                                }
                                if (it.type === 'multiple_choice') {
                                  const c = (it.choices||[]).find(c=>c.is_correct);
                                  return `Answer: ${c ? c.choice_text : ''}`;
                                }
                                if (it.type === 'multiple_answer') {
                                  const arr = (it.choices||[]).filter(c=>c.is_correct).map(c=>c.choice_text);
                                  return `Answer: ${arr.join(', ')}`;
                                }
                                if (it.type === 'matching') {
                                  const pairs = Array.isArray(it?.meta?.pairs)? it.meta.pairs : [];
                                  return pairs.length ? `Answer: ` + pairs.map(p=>`${p.left}→${p.right}`).join(' | ') : 'Answer: —';
                                }
                                if (it.type === 'ordering') {
                                  const order = Array.isArray(it?.meta?.order)? it.meta.order : [];
                                  return order.length ? `Answer: ${order.join(' > ')}` : 'Answer: —';
                                }
                                return '';
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <hr style={{ border: '2px solid #f84d93', margin: '26px 20px' }} />

                  <div style={{ display:'grid', gap:14 }}>
                    {items.map((it, idx) => {
                      const ed = editing[it.id];
                      const imgInputId = `img-input-${it.id}`;
                      return (
                        <div key={it.id} style={{ background:'#fff', padding:16, borderRadius:18, border:'1px solid #eee', boxShadow:'0 14px 28px rgba(0,0,0,0.08)' }}>
                          {!ed ? (
                            <div>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                                <div style={{ fontWeight:900, color:'#3e2a6d', lineHeight:1.5, wordBreak:'break-word', fontSize:18 }}>{`${idx+1}. ${it.question}`}</div>
                                <div style={{ display:'flex', gap:8 }}>
                                  <Tooltip title="Edit item"><IconButton className="qd-icon" onClick={() => beginEdit(it)} sx={{ color:'#6a3ecb', border:'2px solid #6a3ecb', background:'#ffffff', '&:hover':{ background:'#6a3ecb', color:'#ffffff' }, width:56, height:56 }}><EditOutlinedIcon sx={{ fontSize:36 }} /></IconButton></Tooltip>
                                  <Tooltip title="Delete item"><IconButton className="qd-icon" onClick={() => removeItem(it)} sx={{ color:'#d9254f', border:'2px solid #d9254f', background:'#ffffff', '&:hover':{ background:'#d9254f', color:'#ffffff' }, width:56, height:56 }}><DeleteOutlineIcon sx={{ fontSize:36 }} /></IconButton></Tooltip>
                                </div>
                              </div>
                                          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10 }}>
                                <input id={imgInputId} ref={el => { if (el) fileInputsRef.current[imgInputId] = el; }} type="file" accept="image/*" onChange={e => onUploadImage(it, e.target.files?.[0])} style={{ display:'none' }} />
                                {!(it.image_url || it.image_path) && (
                                  <button className="qd-btn-anim qd-invert" onClick={() => fileInputsRef.current[imgInputId]?.click()} style={{ '--btn-bg':'#fff9e6', '--btn-fg':'#b26a00', '--btn-hover-bg':'#ffae0c', '--btn-hover-fg':'#3e2a6d', display:'inline-flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:12, border:'1px solid #ffe08a', background:'#fff9e6', color:'#b26a00', fontWeight:900 }}>
                                    <ImageOutlinedIcon sx={{ color:'#b26a00' }} /> Upload Image
                                  </button>
                                )}
                              </div>
                              {(it.image_url || it.image_path) && (
                                <div style={{ margin:'12px 0', overflow:'hidden', borderRadius:14, border:'1px solid #eee', width:320, height:200 }}>
                                  <img alt="" src={it.image_url ? it.image_url : toAbsoluteUrl(it.image_path)} style={{ width:'100%', height:'100%', display:'block', objectFit:'cover' }} />
                                  <div style={{ padding:6, display:'flex', justifyContent:'flex-end' }}>
                                    <button className="qd-btn-anim" onClick={() => onDeleteImage(it)} style={{ padding:'8px 12px', borderRadius:999, border:'1px solid #ffb3c4', background:'#ffe6ea', color:'#d9254f', fontWeight:900 }}>Remove</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10, flexWrap:'wrap' }}>
                                <div style={{ fontWeight:900, minWidth:40, color:'#6a3ecb', fontSize:18 }}>{idx+1}.</div>
                                <input value={ed.question} onChange={e=>changeEdit(it.id, { question: e.target.value })} placeholder="Question" style={{ flex:1, minWidth:260, padding:12, borderRadius:14, border:'1px solid #e6e0f4', background:'#faf7ff', fontSize:16 }} />
                                <Tooltip title="Question type">
                                  <select value={ed.type} onChange={e=>onTypeChange(it.id, ed, e.target.value)} style={{ padding:'12px 14px', borderRadius:14, border:'1px solid #ffe08a', background:'#fff9e6', fontWeight:900 }}>
                                  <option value="identification">Identification</option>
                                  <option value="multiple_choice">Multiple Choice</option>
                                  <option value="multiple_answer">Multiple Answer</option>
                                  <option value="true_false">True/False</option>
                                  <option value="matching">Matching</option>
                                  <option value="ordering">Ordering</option>
                                  </select>
                                </Tooltip>
                                {!(it.image_url || it.image_path) && (
                                  <IconButton className="qd-icon" size="small" onClick={() => fileInputsRef.current[imgInputId]?.click()} sx={{ color:'#b26a00', border:'2px solid #ffe08a', background:'#fff9e6', borderRadius:2 }}><ImageOutlinedIcon /></IconButton>
                                )}
                                <input id={imgInputId} ref={el => { if (el) fileInputsRef.current[imgInputId] = el; }} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onUploadImage(it, f); }} style={{ display:'none' }} />
                              </div>
                              {(it.image_url || it.image_path) && (
                                <div style={{ margin:'8px 0 12px 0', overflow:'hidden', borderRadius:14, border:'1px solid #eee', width:320, height:200 }}>
                                  <img alt="" src={it.image_url ? it.image_url : toAbsoluteUrl(it.image_path)} style={{ width:'100%', height:'100%', display:'block', objectFit:'cover' }} />
                                  <div style={{ padding:6, display:'flex', justifyContent:'flex-end' }}>
                                    <Tooltip title="Remove image"><button className="qd-btn-anim" onClick={() => onDeleteImage(it)} style={{ padding:'8px 12px', borderRadius:999, border:'1px solid #ffb3c4', background:'#ffe6ea', color:'#d9254f', fontWeight:900 }}>Remove</button></Tooltip>
                                  </div>
                                </div>
                              )}

                              {ed.type === 'ordering' && (
                                <div style={{ display:'grid', gap:14, marginBottom:12, userSelect: dragging?'none':'auto' }}>
                                  <div style={{ fontWeight:800, color:'#3e2a6d' }}>Ordering</div>
                                  {Array.isArray(ed.meta?.order) ? (
                                    <>
                                      {(() => {
                                        // ensure stable ids per item
                                        const cur = orderIdsRef.current[it.id] || [];
                                        const need = (ed.meta.order || []).length;
                                        if (cur.length !== need) {
                                          const next = cur.slice(0, need);
                                          for (let k = cur.length; k < need; k++) next.push(`ord_${it.id}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
                                          orderIdsRef.current[it.id] = next;
                                        }
                                        const ids = orderIdsRef.current[it.id] || [];
                                        return (ed.meta.order || []).map((s, i, arr) => (
                                          <React.Fragment key={ids[i] || i}>
                                          {dragInsertAt===i && dragIdx!=null && (
                                            <div style={{ height:12, margin:'10px 0', borderRadius:6, background:'#000' }} />
                                          )}
                                          <div
                                            draggable
                                            onDragOver={(e)=>{
                                              e.preventDefault();
                                              try { if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; } catch(_) {}
                                              if (dragRaf.current) return;
                                              const target = e.currentTarget;
                                              dragRaf.current = requestAnimationFrame(() => {
                                                dragRaf.current = 0;
                                                const rect = target.getBoundingClientRect();
                                                const beforeZone = rect.top + rect.height*0.4;
                                                const next = (e.clientY < beforeZone) ? i : i+1;
                                                if (dragHoverIdx !== i) setDragHoverIdx(i);
                                                if (dragInsertAt !== next) setDragInsertAt(next);
                                              });
                                            }}
                                            onDragStart={(e)=>{ try { if (e.dataTransfer) { e.dataTransfer.setData('text/plain', 'qd-move'); e.dataTransfer.effectAllowed = 'move'; } } catch(_) {} setDragIdx(i); setDragging(true); setDragInsertAt(i); }}
                                            onDragLeave={()=>{ setDragHoverIdx(null); }}
                                            onDrop={async (e)=>{ e.preventDefault(); const prev = Array.isArray(ed.meta?.order) ? [...ed.meta.order] : []; const order = [...prev]; if (dragIdx==null || dragInsertAt==null) { setDragging(false); setDragHoverIdx(null); setDragInsertAt(null); setDragIdx(null); return; } const from = dragIdx; let to = dragInsertAt; if (to>from) to = to-1; const [m] = order.splice(from,1); order.splice(to,0,m); setDragging(false); setDragHoverIdx(null); setDragInsertAt(null); setDragIdx(null); changeEdit(it.id, { meta: { ...(ed.meta||{}), order } }); showUndo(it.id, prev); await saveOrderingImmediately(it, ed, order); }}
                                            onDragEnd={()=>{ if (dragRaf.current) { cancelAnimationFrame(dragRaf.current); dragRaf.current = 0; } setDragging(false); setDragHoverIdx(null); setDragInsertAt(null); setDragIdx(null); }}
                                            style={{ display:'flex', gap:12, alignItems:'center', padding:'18px', border:'2px solid #000', borderRadius:16, background:'#ffae0c', minHeight:68, cursor: dragging?'grabbing':'grab', transition:'transform 120ms ease, box-shadow 120ms ease', ...(dragging && dragIdx===i ? { transform:'scale(1.01)', boxShadow:'0 14px 26px rgba(0,0,0,0.12)' } : {}) }}
                                          >
                                            
                                            <input value={s||''}
                                              onChange={e=>{ const order=[...(ed.meta.order||[])]; order[i] = e.target.value; changeEdit(it.id, { meta: { ...(ed.meta||{}), order } }); }}
                                              onKeyDown={e=>{ if ((e.altKey||e.ctrlKey) && (e.key==='ArrowUp'||e.key==='ArrowDown')) { e.preventDefault(); const dir = e.key==='ArrowUp' ? -1 : 1; const order = moveOrder(ed, i, dir); changeEdit(it.id, { meta: { ...(ed.meta||{}), order } }); } }}
                                              placeholder={`Step ${i+1}`} style={{ padding:14, borderRadius:12, border:'2px solid #000', flex:1, background:'#fff' }} />
                                            <Tooltip title="Move up"><button className="qd-btn-anim" onClick={()=>{ const order = moveOrder(ed, i, -1); changeEdit(it.id, { meta: { ...(ed.meta||{}), order } }); }} style={{ pointerEvents: dragging?'none':'auto', padding:'8px 12px', borderRadius:999, border:'1px solid #ffae0c', background:'#fff9e6', color:'#b26a00', fontWeight:900 }}>▲</button></Tooltip>
                                      <Tooltip title="Move down"><button className="qd-btn-anim" onClick={()=>{ const order = moveOrder(ed, i, +1); changeEdit(it.id, { meta: { ...(ed.meta||{}), order } }); }} style={{ pointerEvents: dragging?'none':'auto', padding:'8px 12px', borderRadius:999, border:'1px solid #ffae0c', background:'#fff9e6', color:'#b26a00', fontWeight:900 }}>▼</button></Tooltip>
                                          <Tooltip title="Remove step"><button className="qd-btn-anim" onClick={()=>{ const order=(ed.meta?.order||[]).filter((_,idx)=>idx!==i); changeEdit(it.id, { meta: { ...(ed.meta||{}), order } }); }} style={{ pointerEvents: dragging?'none':'auto', padding:'6px 10px', borderRadius:999, border:'1px solid #ffb3c4', background:'#ffe6ea', color:'#d9254f' }}>Remove</button></Tooltip>
                                          </div>
                                          {(dragInsertAt===arr.length && i===arr.length-1 && dragIdx!=null) && (
                                            <div style={{ height:12, margin:'10px 0', borderRadius:6, background:'#000' }} />
                                          )}
                                        </React.Fragment>
                                        ));
                                      })()}
                                    </>
                                  ) : null}
                                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end', width:'100%' }}>
                                    <button className="qd-btn-anim qd-invert" onClick={()=>{ const order=[...(ed.meta?.order||[]), '' ]; changeEdit(it.id, { meta: { ...(ed.meta||{}), order } }); }} style={{ '--btn-bg':'#fff9e6', '--btn-fg':'#b26a00', '--btn-hover-bg':'#ffae0c', '--btn-hover-fg':'#3e2a6d', alignSelf:'flex-start', padding:'10px 14px', borderRadius:14, border:'1px solid #ffe08a', background:'#fff9e6', color:'#b26a00', fontWeight:900 }}>Add Step</button>
                                    <button className="qd-btn-anim qd-invert" onClick={async ()=>{ const base = Array.isArray(ed.meta?.order) ? [...ed.meta.order] : []; const prev = [...base]; const shuffled = base.map(v=>({v, r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.v); changeEdit(it.id, { meta: { ...(ed.meta||{}), order: shuffled } }); showUndo(it.id, prev); await saveOrderingImmediately(it, ed, shuffled); }} style={{ '--btn-bg':'#fff4cc', '--btn-fg':'#b26a00', '--btn-hover-bg':'#ffae0c', '--btn-hover-fg':'#3e2a6d', alignSelf:'flex-start', padding:'10px 14px', borderRadius:14, border:'1px solid #ffe08a', background:'#fff4cc', color:'#b26a00', fontWeight:900 }}>Shuffle</button>
                                  </div>
                                  {undoInfo?.itemId===it.id && (
                                    <div style={{ marginTop:8, background:'#fffef6', border:'1px solid #ffefcc', borderRadius:12, padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                      <span style={{ color:'#6a3ecb', fontWeight:700 }}>Order saved.</span>
                                      <button className="qd-btn-anim qd-invert" onClick={handleUndo} style={{ '--btn-bg':'#ffffff', '--btn-fg':'#6a3ecb', '--btn-hover-bg':'#6a3ecb', '--btn-hover-fg':'#ffffff', padding:'8px 12px', borderRadius:12, border:'1px solid #d6c7ff', background:'#f7f2ff', color:'#6a3ecb', fontWeight:900 }}>Undo</button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {ed.type === 'identification' ? (
                                <input value={ed.correct_answer} onChange={e=>changeEdit(it.id, { correct_answer: e.target.value })} placeholder="Correct answer" style={{ padding:10, borderRadius:12, border:'1px solid #e6e0f4', width:'100%', marginBottom:8, background:'#faf7ff' }} />
                              ) : ed.type === 'multiple_choice' ? (
                                <div style={{ display:'grid', gap:6, marginBottom:8 }}>
                                  {(ed.choices||[]).map((c, idx2) => (
                                    <div key={idx2} style={{ display:'flex', gap:8, alignItems:'center' }}>
                                      <input type="checkbox" checked={!!c.is_correct} onChange={e=>{ const list = (ed.choices||[]).map((ch, i) => ({ ...ch, is_correct: false })); if (e.target.checked) list[idx2] = { ...list[idx2], is_correct: true }; changeEdit(it.id, { choices: list }); }} title="Correct (single)" />
                                      <input value={c.choice_text} onChange={e=>{ const list=[...(ed.choices||[])]; list[idx2] = { ...list[idx2], choice_text: e.target.value }; changeEdit(it.id, { choices: list }); }} placeholder={`Choice ${idx2+1}`} style={{ flex:1, padding:10, borderRadius:12, border:'1px solid #e6e0f4', background:'#fff' }} />
                                      <button className="qd-btn-anim" onClick={()=>removeChoice(it.id, idx2)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #ffb3c4', background:'#ffe6ea', color:'#d9254f' }}>Remove</button>
                                    </div>
                                  ))}
                                  <button className="qd-btn-anim" onClick={()=>addChoice(it.id)} style={{ alignSelf:'flex-start', padding:'8px 12px', borderRadius:12, border:'1px solid #e6e0f4', background:'#fff' }}>Add Choice</button>
                                </div>
                              ) : ed.type === 'multiple_answer' ? (
                                <div style={{ display:'grid', gap:6, marginBottom:8 }}>
                                  {(ed.choices||[]).map((c, idx2) => (
                                    <div key={idx2} style={{ display:'flex', gap:8, alignItems:'center' }}>
                                      <input type="checkbox" checked={!!c.is_correct} onChange={e=>{ const list = [...(ed.choices||[])]; list[idx2] = { ...list[idx2], is_correct: e.target.checked }; changeEdit(it.id, { choices: list }); }} title="Correct" />
                                      <input value={c.choice_text} onChange={e=>{ const list=[...(ed.choices||[])]; list[idx2] = { ...list[idx2], choice_text: e.target.value }; changeEdit(it.id, { choices: list }); }} placeholder={`Choice ${idx2+1}`} style={{ flex:1, padding:10, borderRadius:12, border:'1px solid #e6e0f4', background:'#fff' }} />
                                      <button className="qd-btn-anim" onClick={()=>removeChoice(it.id, idx2)} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #ffb3c4', background:'#ffe6ea', color:'#d9254f' }}>Remove</button>
                                    </div>
                                  ))}
                                  <button className="qd-btn-anim" onClick={()=>addChoice(it.id)} style={{ alignSelf:'flex-start', padding:'8px 12px', borderRadius:12, border:'1px solid #e6e0f4', background:'#fff' }}>Add Choice</button>
                                </div>
                              ) : ed.type === 'true_false' ? (
                                <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:8 }}>
                                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <input type="radio" name={`tf-${it.id}`} checked={!!ed.tf_correct} onChange={()=>changeEdit(it.id, { tf_correct: true })} /> True
                                  </label>
                                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <input type="radio" name={`tf-${it.id}`} checked={!ed.tf_correct} onChange={()=>changeEdit(it.id, { tf_correct: false })} /> False
                                  </label>
                                </div>
                              ) : ed.type === 'matching' ? (
                                <div style={{ display:'grid', gap:8, marginBottom:8 }}>
                                  <div style={{ fontWeight:800, color:'#3e2a6d' }}>Pairs</div>
                                  {Array.isArray(ed.meta?.pairs) ? ed.meta.pairs.map((p, i) => (
                                    <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
                                      <input value={p.left||''} onChange={e=>{ const pairs=[...(ed.meta.pairs||[])]; pairs[i] = { ...pairs[i], left: e.target.value }; changeEdit(it.id, { meta: { ...(ed.meta||{}), pairs } }); }} placeholder={`Left ${i+1}`} style={{ padding:10, borderRadius:12, border:'1px solid #e6e0f4', flex:1 }} />
                                      <span>→</span>
                                      <input value={p.right||''} onChange={e=>{ const pairs=[...(ed.meta.pairs||[])]; pairs[i] = { ...pairs[i], right: e.target.value }; changeEdit(it.id, { meta: { ...(ed.meta||{}), pairs } }); }} placeholder={`Right ${i+1}`} style={{ padding:10, borderRadius:12, border:'1px solid #e6e0f4', flex:1 }} />
                                      <button className="qd-btn-anim" onClick={()=>{ const pairs=(ed.meta?.pairs||[]).filter((_,idx)=>idx!==i); changeEdit(it.id, { meta: { ...(ed.meta||{}), pairs } }); }} style={{ padding:'6px 10px', borderRadius:999, border:'1px solid #ffb3c4', background:'#ffe6ea', color:'#d9254f' }}>Remove</button>
                                    </div>
                                  )) : null}
                                  <button className="qd-btn-anim" onClick={()=>{ const pairs=[...(ed.meta?.pairs||[]), { left:'', right:'' }]; changeEdit(it.id, { meta: { ...(ed.meta||{}), pairs } }); }} style={{ alignSelf:'flex-start', padding:'8px 12px', borderRadius:12, border:'1px solid #e6e0f4', background:'#fff' }}>Add Pair</button>
                                </div>
                              ) : null}
                              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                <Tooltip title="Save changes"><button className="qd-btn-anim qd-invert" onClick={() => saveEdit(it)} style={{ '--btn-bg':'#ffae0c', '--btn-fg':'#3e2a6d', '--btn-hover-bg':'#3e2a6d', '--btn-hover-fg':'#ffae0c', padding:'12px 16px', borderRadius:14, border:'1px solid #ffae0c', background:'#ffae0c', color:'#3e2a6d', fontWeight:900, fontSize:16 }}>Save</button></Tooltip>
                                <Tooltip title="Cancel editing"><button className="qd-btn-anim" onClick={() => setEditing(prev => { const cp = { ...prev }; delete cp[it.id]; return cp; })} style={{ padding:'12px 16px', borderRadius:14, border:'1px solid #e6e0f4', background:'#fff', fontWeight:900, fontSize:16 }}>Cancel</button></Tooltip>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {items.length === 0 && <div style={{ opacity:.7, fontSize:16 }}>No items yet.</div>}
                  </div>
                </>
              ))}
              {showPreview && (
                <PreviewQuizModal token={token} quizId={id} onClose={() => setShowPreview(false)} />
              )}
            </div>
          </div>
          <SidebarRight isOpen={isRightOpen} />
          {(isLeftOpen || isRightOpen) && (<div style={overlayStyles} onClick={() => { setIsLeftOpen(false); setIsRightOpen(false); }} />)}
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
              >{/delete/i.test(confirmDlg.message||'') ? 'Delete' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </CustomThemeProvider>
  );
}
