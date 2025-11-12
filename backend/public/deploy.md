 I’m preparing QuizDeck for full production deployment, but before that, I need a complete refactor and consistency pass.

 Project stack:
 - Laravel (backend)
 - React (frontend)
 - AWS RDS (MySQL)
 - AWS S3 (for images)
 - Hosting: AWS EC2 (Ubuntu + Nginx)

 Everything works on localhost, but there are possible inconsistencies between frontend and backend integration (API URLs, axios calls, state handling, and Laravel controllers).

 Your task:
 Perform a **refactor and consistency optimization pass** across the entire codebase, then prepare it for production deployment.

 ---

 ### Goals

 1. Fix all inconsistencies between backend and frontend:
    - Make sure all API calls in React point to `process.env.REACT_APP_API_BASE`.
    - Standardize all routes, endpoints, and controllers so React and Laravel match perfectly.
    - Fix any case sensitivity issues (important for Linux EC2 environments).
    - Ensure image upload and deletion logic fully matches between Laravel and S3.
    - Confirm that all quiz-related CRUD endpoints are properly authenticated and error-handled.

 2. Optimize structure and remove local-only logic:
    - Replace any hardcoded localhost URLs with environment variables.
    - Remove debugging or console logs from production builds.
    - Simplify complex useEffects or redundant React states.
    - Optimize React re-renders where it helps with performance.

 3. Strengthen backend for production:
    - Verify middleware usage (auth, verify, cors, csrf).
    - Ensure all API routes are prefixed with `/api`.
    - Review all controllers and models for naming consistency and redundant imports.
    - Cache config, routes, and views.
    - Optimize Eloquent queries (eager loading, pagination).
    - Ensure `APP_DEBUG=false` in production.

 4. Ensure AWS compatibility:
    - Confirm S3 credentials are correctly referenced from `.env`.
    - Verify S3 path formats:
      ```
      quizdeck-profile-images/quiz_images/{quiz_id}/{item_number}/image.png
      ```
    - Confirm Laravel’s file storage driver is set to `s3` and works under production conditions.
    - Make sure database connections use the RDS endpoint.

 5. Frontend build consistency:
    - Refactor React routing so it gracefully handles deep routes (404s served from index.html).
    - Ensure all components that fetch data handle loading/error states cleanly.
    - Replace all absolute imports with relative paths (if mismatched).
    - Use dynamic imports or lazy loading where it helps with performance.

 6. Environment prep:
    - Generate production `.env` and `.env.production` with correct URLs:
      ```
      APP_ENV=production
      APP_DEBUG=false
      APP_URL=https://quizdeck.com
      FRONTEND_URL=https://quizdeck.com
      REACT_APP_API_BASE=https://quizdeck.com/api
      ```
    - Verify all sensitive data (API keys, AWS, DB credentials) are only referenced via environment variables.

 7. Deployment setup:
    - Prepare EC2-ready Nginx configuration (React frontend + Laravel backend under /api).
    - Add SSL setup instructions via Certbot.
    - Ensure React build and Laravel serve side-by-side cleanly.

 8. Testing and verification:
    - Test CRUD operations, quiz creation, image upload/deletion, login, registration, Gmail verification.
    - Test that page load times (Dashboard, Courses, Quizzes, Profile) are within 1–5 seconds.
    - Test session persistence and quiz resume after refresh.
    - Verify S3 operations, MySQL connections, and API authentication.

 ---

 ### Deliverables

 After refactoring:
 - A summary of inconsistencies found and fixed (API mismatches, naming, file path issues).
 - Cleaned and production-ready React and Laravel code.
 - Updated `.env` samples for production.
 - A short report confirming that all APIs, AWS integrations, and routes are consistent.

 ---

 Use this as your **primary refactor and deployment-prep directive**.  
 Make all adjustments needed, verify logic consistency, and prepare for a smooth AWS EC2 production deployment.

Refactor this project for AWS EC2 deployment.

Tasks:

Prepare and configure the app to run on an EC2 instance (Ubuntu-based preferred).

Replace any existing local caching system with Amazon ElastiCache (Redis) using AWS SDK or redis-py, and ensure it connects through AWS free-tier compatible settings.

Scan all project folders and replace any localhost references with:

the EC2 instance’s private IP for internal connections, or

the public IPv4 address for external access (depending on context).

Use environment variables for any AWS or Redis connection details (.env file).

Ensure the setup remains compatible with AWS free-tier usage only.

Do not configure or reference any domain name — just use the EC2 public IP for access.

Generate or update deployment scripts (like a deploy.sh or Dockerfile if needed) to automate setup and environment initialization on EC2.

Include AWS CLI configuration and security group notes for Redis and the app (open port 6379 for Redis internally, port 80 or 5000 for HTTP access).

Add comments explaining what was changed and wh