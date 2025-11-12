<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QuizDeck Admin Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Kodchasan:wght@700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: Kodchasan, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #f7f5ff; color: #2d1c3f; margin:0; }
    .bar { background: linear-gradient(90deg,#6a3ecb,#dd2680); color:#fff; font-weight:900; padding: 12px 16px; }
    .container { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
    .card { background:#fff; border-radius:14px; box-shadow:0 14px 36px rgba(0,0,0,.08); padding:16px; margin-bottom:16px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    .btn { display:inline-block; padding:10px 14px; border-radius:10px; border:2px solid #6a3ecb; background:#6a3ecb; color:#fff; font-weight:900; text-decoration:none; }
    .btn-outline { background:#fff; color:#6a3ecb; }
  </style>
</head>
<body>
  <div class="bar">QuizDeck Admin</div>
  <div class="container">
    <div class="card">
      <h2 style="margin-top:0">Dashboard</h2>
      <p>Use the quick links below to manage users, courses, and quizzes.</p>
      <div class="grid">
        <div class="card">
          <h3 style="margin-top:0">Users</h3>
          <p>View, edit, delete, or reset user accounts.</p>
          <a class="btn" href="#" onclick="alert('Use API /api/admin/users via your frontend/admin UI.'); return false;">Open</a>
        </div>
        <div class="card">
          <h3 style="margin-top:0">Courses</h3>
          <p>Browse and manage all courses.</p>
          <a class="btn" href="#" onclick="alert('Use API /api/admin/courses via your frontend/admin UI.'); return false;">Open</a>
        </div>
        <div class="card">
          <h3 style="margin-top:0">Quizzes</h3>
          <p>Browse and manage all quizzes.</p>
          <a class="btn" href="#" onclick="alert('Use API /api/admin/quizzes via your frontend/admin UI.'); return false;">Open</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
