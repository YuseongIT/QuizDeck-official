Context: Use the Quiz & Grades System context defined in backend_context.md. Build React frontend components and API hooks for all features, matching the data flow, navigation, roles, and styling rules.

Requirements:

Component Structure

CourseDetailsPage with two buttons: Quizzes, Grades.

QuizzesPage:

For Teachers: Display all created quizzes as cards with title, description, availability toggle, buttons for Edit, Delete, Manage Content, Preview.

For Students: Display available quizzes as cards with View button and shared quizzes.

CreateQuizModal: Form to create a new quiz (title, description, repeatable, course selector for teachers, sharable toggle for students).

ManageQuizContentPage:

List all quiz items.

Add Item button → modal to select question type (Identification or Multiple Choice).

Each item can be edited, deleted, attach an image, mark correct answers, add/remove choices dynamically.

Publish button to save and publish quiz.

TakeQuizModal:

Opens when student clicks “View” or “Take Quiz”.

Shows course name, teacher, description, number of items.

Start button → displays quiz interface.

Autosave progress every 10 seconds via API hook.

Pause and resume logic on refresh with modal confirmation.

Submit button → grades quiz and displays score.

PreviewQuizModal (Teacher):

Opens quiz interface exactly as students see it, no grade recording.

GradesPage:

Teachers see class results for each quiz: student name, profile picture, score, percentage.

Students see their own results and shared quizzes.

API Hooks

Use React Query or custom hooks.

API endpoints per backend_context.md.

Hooks should handle:

GET /api/quizzes → fetch quizzes based on user role.

POST /api/quizzes → create quiz.

PATCH /api/quizzes/{id} → edit quiz.

DELETE /api/quizzes/{id} → delete quiz.

PATCH /api/quizzes/{id}/publish → publish quiz.

PATCH /api/quizzes/{id}/toggle → toggle availability.

GET /api/quiz-items/{quiz_id} → fetch quiz items.

POST /api/quiz-items → add question.

PATCH /api/quiz-items/{id} → edit question.

DELETE /api/quiz-items/{id} → delete question.

POST /api/quiz-items/{id}/image → upload image.

DELETE /api/quiz-items/{id}/image → delete image.

POST /api/quiz-attempts → start quiz attempt.

PATCH /api/quiz-attempts/{id}/autosave → autosave progress.

PATCH /api/quiz-attempts/{id}/submit → submit and grade quiz.

GET /api/grades → fetch grades.

State Management

Use Context API or Zustand for:

Current user role.

Quiz in progress data.

Local draft edits.

Quiz attempt ID and progress.

Use localStorage to persist in-progress quiz data on refresh.

Implement autosave with 10-second interval.

Styling

Kodchasan font across all components.

Buttons: scale hover effect.

Cards: hover shadow and lift.

Modals: fade-in, scale transitions, background blur.

Toggles: smooth slide animation.

Popups: soft glow, dynamic colors based on palette.

Behavior and Edge Cases

Teacher Preview: teachers cannot record grades, just simulate quiz-taking interface.

Students: autosave progress, resume on refresh, pause modal.

Multiple-choice questions: dynamic add/remove choices, mark correct answer.

Identification questions: answer input, optional image.

Image uploads: preview, save to S3, delete on item delete.

Quiz deletion: cascade delete items, responses, S3 images.

Repeatable quizzes: enforce repeat logic.

Navigation Flow

CourseDetails → Quizzes → Quiz cards → Manage / Take / Preview

CourseDetails → Grades → Teacher: student results, Student: own results and shared quizzes

ManageQuizContentPage → Add/Edit/Delete items → Publish

TakeQuizModal → Start → Autosave → Submit → Show score

PreviewQuizModal → Teacher sees simulated quiz interface

Deliverables

All React components needed for Quizzes and Grades.

API hooks matching backend routes.

Autosave and localStorage resume logic.

Dynamic role-based rendering (Teacher vs Student).

Modular, reusable components for items, choices, modals, quiz cards, and grades list.