import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { apiRequest } from './api';

const Card = ({ title, children }) => (
  <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 18px 44px rgba(0,0,0,.08)', padding:16 }}>
    <div style={{ fontWeight:900, marginBottom:8 }}>{title}</div>
    {children}
  </div>
);

export default function AdminDashboard(){
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users:0, courses:0, quizzes:0 });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const errs = [];
      let users = [], courses = [], quizzes = [];
      try { users = await apiRequest('/api/admin/users', { token }); }
      catch (e) { errs.push({ endpoint:'/api/admin/users', message: e.message, status: e.status }); }
      try { courses = await apiRequest('/api/admin/courses', { token }); }
      catch (e) { errs.push({ endpoint:'/api/admin/courses', message: e.message, status: e.status }); }
      try { quizzes = await apiRequest('/api/admin/quizzes', { token }); }
      catch (e) { errs.push({ endpoint:'/api/admin/quizzes', message: e.message, status: e.status }); }
      if (!mounted) return;
      setStats({ users: (users||[]).length, courses: (courses||[]).length, quizzes: (quizzes||[]).length });
      setErrors(errs);
      if (errs.length) setError('Some admin services failed to load.'); else setError('');
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [token]);

  if (!user?.is_admin) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Kodchasan, system-ui' }}>
        <div style={{ background:'#fff', padding:20, borderRadius:16, boxShadow:'0 18px 44px rgba(0,0,0,.1)' }}>Unauthorized</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f7f5ff', padding:'24px', fontFamily:'Kodchasan, system-ui' }}>
      <div style={{ background:'linear-gradient(90deg,#6a3ecb,#dd2680)', color:'#fff', padding:'12px 16px', borderRadius:14, fontWeight:900, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>QuizDeck Admin</span>
        <button
          onClick={async ()=>{
            const ok = window.confirm('Log out of the Admin Dashboard?');
            if (!ok) return;
            try{ await apiRequest('/api/logout',{ method:'POST', token }); }catch(_){ }
            try { window.dispatchEvent(new CustomEvent('toast', { detail: { type:'success', message:'Logged out successfully.' } })); } catch(_){}
            if (logout) await logout();
            navigate('/login');
          }}
          style={{ padding:'8px 12px', borderRadius:10, border:'2px solid #ffffff', background:'#ffffff', color:'#6a3ecb', fontWeight:900, cursor:'pointer' }}
        >Logout</button>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
          <Card title={`Users (${stats.users})`}>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>navigate('/admin/users')} style={btn()}>Manage Users</button>
              <button onClick={async()=>{
                if (!window.confirm('Delete ALL non-admin users?')) return;
                await apiRequest('/api/admin/users/reset', { method:'POST', token });
                const list = await apiRequest('/api/admin/users', { token });
                setStats(s=>({ ...s, users:list.length }));
              }} style={btn('#d9254f','#fff')}>Reset Users</button>
            </div>
          </Card>
          <Card title={`Courses (${stats.courses})`}>
            <button onClick={()=>navigate('/admin/courses')} style={btn()}>Manage Courses</button>
          </Card>
          <Card title={`Quizzes (${stats.quizzes})`}>
            <button onClick={()=>navigate('/admin/quizzes')} style={btn()}>Manage Quizzes</button>
          </Card>
        </div>
      )}
      {error && (
        <div style={{ marginTop:12, color:'#d9254f' }}>
          {error}
          {errors.length > 0 && (
            <ul style={{ marginTop:8 }}>
              {errors.map((er, i) => (
                <li key={i}><strong>{er.endpoint}</strong>: {er.message} {er.status ? `(status ${er.status})` : ''}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function btn(bg='#6a3ecb', color='#fff'){
  return {
    padding:'10px 14px',
    borderRadius:12,
    border:`2px solid ${bg}`,
    background:bg,
    color,
    fontWeight:900,
    boxShadow:'0 6px 0 rgba(0,0,0,0.18)',
    cursor:'pointer'
  };
}
