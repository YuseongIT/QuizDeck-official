import { apiRequest, API_BASE } from '../api';

export function quizzesApi(token) {
  return {
    list: () => apiRequest('/api/quizzes', { token }),
    byCourse: (courseId) => apiRequest(`/api/quizzes/${courseId}`, { token }),
    get: (id) => apiRequest(`/api/quiz/${id}`, { token }),
    create: (payload) => apiRequest('/api/quizzes', { method: 'POST', token, body: payload }),
    update: (id, payload) => apiRequest(`/api/quizzes/${id}`, { method: 'PATCH', token, body: payload }),
    remove: (id) => apiRequest(`/api/quizzes/${id}`, { method: 'DELETE', token }),
    publish: (id) => apiRequest(`/api/quizzes/${id}/publish`, { method: 'PATCH', token }),
    toggle: (id) => apiRequest(`/api/quizzes/${id}/toggle`, { method: 'PATCH', token }),
    autosave: (id, payload) => apiRequest(`/api/quizzes/${id}/autosave`, { method: 'PATCH', token, body: payload }),
    uploadPreview: async (id, file) => {
      const base = API_BASE;
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${base}/api/quizzes/${id}/preview-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        let msg = 'Upload failed';
        try { const j = await res.json(); msg = j.message || msg; } catch(_){}
        throw new Error(msg);
      }
      return await res.json();
    }
  };
}

export function quizItemsApi(token) {
  return {
    list: (quizId) => apiRequest(`/api/quiz-items/${quizId}`, { token }),
    create: (payload) => apiRequest('/api/quiz-items', { method: 'POST', token, body: payload }),
    update: (id, payload) => apiRequest(`/api/quiz-items/${id}`, { method: 'PATCH', token, body: payload }),
    remove: (id) => apiRequest(`/api/quiz-items/${id}`, { method: 'DELETE', token }),
    uploadImage: async (id, file, token) => {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(API_BASE + `/api/quiz-items/${id}/image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      return await res.json();
    },
    deleteImage: (id) => apiRequest(`/api/quiz-items/${id}/image`, { method: 'DELETE', token }),
    uploadMedia: async (id, file, token) => {
  const formData = new FormData();
  formData.append('media', file);
  const res = await fetch(API_BASE + `/api/quiz-items/${id}/media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return await res.json();
},
deleteMedia: (id) => apiRequest(`/api/quiz-items/${id}/media`, { method: 'DELETE', token }),
  };
}

export function attemptsApi(token) {
  return {
    start: (quiz_id) => apiRequest('/api/quiz-attempts', { method: 'POST', token, body: { quiz_id } }),
    autosave: (id, in_progress_data) => apiRequest(`/api/quiz-attempts/${id}/autosave`, { method: 'PATCH', token, body: { in_progress_data } }),
    submit: (id, answers) => apiRequest(`/api/quiz-attempts/${id}/submit`, { method: 'PATCH', token, body: { answers } }),
    remove: (id) => apiRequest(`/api/quiz-attempts/${id}`, { method: 'DELETE', token }),
  };
}

export function gradesApi(token) {
  return {
    list: () => apiRequest('/api/grades', { token }),
    listByQuiz: (quizId) => apiRequest(`/api/grades?quiz_id=${quizId}`, { token }),
  };
}
