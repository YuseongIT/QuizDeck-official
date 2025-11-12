PROJECT CONTEXT
Quiz & Grades System
Stack: Laravel backend + React frontend
Database: AWS MySQL
Storage: AWS S3 (bucket name quizdeck-profile-images)
Font: Kodchasan (use globally)
Color Palette: use existing site palette dynamically

SYSTEM OVERVIEW
The app manages quizzes and grades for teachers and students.

Course Details page now has two buttons:

Quizzes

Grades

Each opens its own section. The behavior depends on the user role.

TEACHER ROLE

Can create, edit, delete, publish, preview, and toggle quiz availability.

Each quiz card displays title, description, availability toggle, and buttons for Edit, Delete, Manage Content, and Preview.

Manage Content allows adding, editing, and deleting quiz items.

Preview lets teachers test their quizzes as students would, but no grades are recorded.

Published quizzes appear on the dashboard for both teachers and enrolled students.

Grades tab shows all enrolled students and their quiz results.

STUDENT ROLE

Can view published quizzes from enrolled courses and shared quizzes from friends.

Can take quizzes, see results, and create their own sharable quizzes.

Sharable quizzes are only available to friends if toggled on.

If a student leaves or is removed from a course, their quiz scores are deleted automatically.

QUIZ CREATION FLOW

User clicks Create Quiz.

Fill in: title, description, is_repeatable.
Teachers also pick a course.
Students can toggle is_shared.

Submit → backend creates quiz record → returns quiz_id.

Redirect to /quiz/{quiz_id}/manage.

Manage page allows adding items.
Add Item opens a modal asking for question type (Identification or Multiple Choice).
User can write the question, mark correct answers, and optionally upload an image.
Images are uploaded to S3 under quiz_images/{quiz_id}/{item_id}/{uuid}/image.

Users can delete questions and attached images with confirmation prompts.

Once ready, Publish makes the quiz available to students.

QUIZ TAKING FLOW (STUDENTS)

Click View Quiz to open a popup.

Popup shows course name, teacher, description, and number of items.

Click Start to begin.

Autosave progress every 10 seconds to backend.

On page refresh, the system pauses and shows “Quiz paused. Resume?”

On submit, system grades answers, calculates score, and locks the quiz if not repeatable.

DATABASE STRUCTURE

users
id, name, email, role, profile_image, timestamps

courses
id, name, description, teacher_id, timestamps

course_enrollments
id, course_id, student_id, timestamps

quizzes
id, title, description, course_id (nullable for student quizzes), creator_id, is_published, is_repeatable, is_shared, is_available, timestamps

quiz_items
id, quiz_id, type (multiple_choice or identification), question, correct_answer, image_path, order_index, timestamps

quiz_choices
id, item_id, choice_text, is_correct, timestamps

quiz_attempts
id, quiz_id, student_id, score, total_items, is_submitted, in_progress_data (json), timestamps

quiz_responses
id, attempt_id, item_id, selected_answer, is_correct, timestamps

Cascade delete rules:
Deleting a quiz deletes items, choices, attempts, responses, and any S3 images.
Removing a student deletes their attempts and responses.

API ROUTES

GET /api/quizzes → list all quizzes
POST /api/quizzes → create quiz
GET /api/quizzes/{id} → get quiz details
PATCH /api/quizzes/{id} → edit quiz
DELETE /api/quizzes/{id} → delete quiz and related records
PATCH /api/quizzes/{id}/publish → publish quiz
PATCH /api/quizzes/{id}/toggle → toggle availability
GET /api/quiz-items/{quiz_id} → fetch items
POST /api/quiz-items → create item
PATCH /api/quiz-items/{id} → edit item
DELETE /api/quiz-items/{id} → delete item
POST /api/quiz-items/{id}/image → upload question image to S3
DELETE /api/quiz-items/{id}/image → delete image from S3
POST /api/quiz-attempts → start quiz attempt
PATCH /api/quiz-attempts/{id}/autosave → autosave answers
PATCH /api/quiz-attempts/{id}/submit → grade quiz and finalize
GET /api/grades → fetch teacher or student grades

DATA FLOW

Course Details → Quizzes Section
→ Create Quiz → /api/quizzes → /quiz/{quiz_id}/manage
→ Manage Quiz → /api/quiz-items CRUD + S3 image upload
→ Publish → /api/quizzes/{quiz_id}/publish
→ Students view published quizzes → /api/quiz-attempts for progress and submission
→ Grades Tab → /api/grades

NAVIGATION FLOW

Course Details
→ Quizzes Tab
→ Teacher: Create Quiz, Manage Quiz, Preview, Toggle Availability
→ Student: View Available Quizzes, Take Quiz, Create Sharable Quiz
→ Grades Tab
→ Teacher: View class results
→ Student: View own and shared results

ACCESS CONTROL

Teachers:
Can manage quizzes for their courses, publish/unpublish, toggle availability, and preview.
Cannot take quizzes for grading.

Students:
Can take published quizzes and create sharable ones.
Cannot access teacher manage endpoints.

LOCAL STORAGE KEYS

quiz_in_progress_{quiz_id} stores quiz attempt state
quiz_autosave_time stores timestamp of last save
quiz_draft_temp stores unsaved draft items
quiz_edit_state caches edit session

EDGE CASES

Refresh mid-quiz: autosave + resume modal
Delete quiz: cascade delete from DB and S3
Edit published quiz: require confirmation
Remove student: delete related attempts and responses
Upload failure: rollback transaction
Duplicate image: use UUID filenames
Lost connection: retry autosave

STYLING RULES

Use Kodchasan font across all components.
Buttons: scale on hover, smooth transitions.
Cards: lift and shadow on hover.
Toggles: rounded with smooth slide animation.
Popups: blur background, soft glow.