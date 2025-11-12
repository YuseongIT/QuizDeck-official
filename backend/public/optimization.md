TASK: Optimize page loading performance for QuizDeck.

CONTEXT:
I'm using Laravel for the backend, React for the frontend, S3 for image storage, and AWS MySQL for the database. I do NOT want to rely on external caching or acceleration services (no Redis, Cloudflare, or external CDNs). Everything should remain internally optimized.

TARGET PAGES:
- Dashboard
- Profile (and viewing other users’ profiles)
- Course Management Page
- Quizzes Page
- Courses Page
- Announcements Page

GOAL:
Each of the above pages should load fully within **1–5 seconds** (ideally under 3 seconds) while maintaining support for **multi-user sessions**. Pages should render quickly, even if multiple users are active.

INSTRUCTIONS:
1. **Backend (Laravel)**
   - Use eager loading (`with()`) to eliminate N+1 queries.
   - Implement simple query caching using `Cache::remember()`, with cache keys unique per user (e.g., `dashboard_data_{user_id}`).
   - Minimize response payloads using API Resource Transformers — include only the data required by the frontend.
   - Add indexing on columns often used for lookups (user_id, course_id, quiz_id).
   - Fetch and generate signed S3 URLs only when needed (lazy-load image access).

2. **Frontend (React)**
   - Use `Promise.all()` to run multiple API calls in parallel instead of sequentially.
   - Implement skeleton loading and React Suspense fallback components for smoother perceived performance.
   - Cache frequently accessed data (dashboard info, profile data, course list) in localStorage or sessionStorage to reduce redundant API calls.
   - Optimize re-renders with `React.memo`, `useCallback`, and `useMemo`.
   - Implement code splitting for large pages using dynamic imports (`React.lazy()`).
   - Reuse a shared context or global state provider for user/session/course data so page transitions don’t trigger unnecessary refetches.

3. **User Experience**
   - Preload key user session and course data after login.
   - Maintain consistent multi-tab sessions without redundant fetches.
   - Invalidate and refresh cached data when a user updates, creates, or deletes a quiz/course.

4. **Performance Validation**
   - Measure total API response time for each page and ensure total page load stays within 1–5 seconds on a standard 5 Mbps connection.
   - Verify no duplicate queries or heavy re-fetches occur.
   - Confirm the app remains functional across simultaneous user sessions.

EXPECTED RESULT:
- All key pages render under 5 seconds.
- Smooth UI transitions with skeleton loaders and cached data.
- No redundant API calls or unoptimized DB queries.
- Consistent session data across pages.

Do not add new dependencies. All optimizations must work using Laravel, React, and AWS stack components already present.
