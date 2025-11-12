🧠 Objective

Refactor and expand the existing Quiz Management System to support the new quiz workflow for both Teachers and Students, integrating S3 image uploads, drafts, publishing, auto-saving, grades persistence, course deletion cascade, and visibility rules based on course membership.

Use existing React components, Laravel backend, AWS S3 for image storage, and AWS MySQL (RDS) for persistent data. Maintain the current file structure and refactor as needed — no redesign from scratch.

🧩 Core Principles

Keep all user authentication, session, and email associations as is.

Use Kodchasan font and color theme (Purple, Yellow, Pink).

Implement friendly, bubbly toasts.

UI animations, hover, and elevation should feel alive and responsive.

No Tailwind or Shadcn UI. Use clean React CSS or SCSS components.

Follow existing routing patterns. Add back buttons to all modals or detail pages.

⚙️ Data Flow Overview

When a user (Teacher or Student) creates a quiz, the flow is:

User clicks Create Quiz.

Popup appears with fields:

Quiz Title

Description

Repeatable toggle

Optional preview image (uploadable to S3)

Upon clicking Create, a draft quiz is stored in MySQL.

If an image was chosen, upload to quizdeck-profile-images/preview_images/{quiz_id}/image.jpg and save its public URL in preview_image_url.

Draft appears in the course’s management view (for teachers) or under My Quizzes (for students).

Drafts are editable — including title, description, repeatable toggle, and image replacement (which overwrites the S3 object).

Teachers and Students both have the option to Save, Delete, View, or Publish.

Once published, quizzes become read-only except for toggles like repeatable, availability, or share visibility.

🧮 Backend (Laravel)

Extend the quizzes table to include:
preview_image_url, status (draft or published), is_repeatable, is_available, is_shared, creator_role, creator_id, course_id, and timestamps.

On course deletion, cascade-delete quizzes linked to that course.

When a student leaves or is removed from a course, remove visibility of that course’s quizzes for them.

Grades remain in the grades table even if the quiz or course is deleted.

Add logic to prevent quiz editing once published.

Add a separate route for uploading and replacing images to S3, linked to the quiz ID.

Implement autosave endpoints for draft quiz content (triggered on refresh or before unload).

Preserve grade data integrity for all users.

🧱 Frontend (React)
Quiz Creation Popup

Fields: title, description, repeatable toggle, image upload input.

Preview image displays immediately once uploaded.

Create button saves draft → backend returns quiz data → modal closes and quiz card appears in UI.

Quiz Cards (Teacher View)

Shows quiz title, description, course name, teacher name, number of items, image preview (if available), creation date, draft/published label, repeatable toggle, and buttons for View, Save changes, Delete, and Publish.

When a draft is viewed, popup allows editing details, changing image, and managing content.

“Manage” opens the quiz editor where items are created and autosaved.

Once published, the quiz card updates visually to show its published state and the number of students who took it (e.g., 1/5 students). The count will adjust if the number of students in the course changes.

Published quizzes are visible in the Dashboard and Course Management pages.

When “View” is clicked on a published quiz, the popup shows “View Items” instead of “Manage”.

Quiz Cards (Student View)

Drafts and published quizzes appear under “My Quizzes”.

Similar layout, but with an additional toggle to make the quiz Private or Shared with Friends.

Shared quizzes appear in the new dashboard section “Quizzes by those you know”, visible to friends or teachers they’re connected with.

Students can also take their own quizzes.

Quiz Popup (Universal)

Contains all editable fields for drafts.

Buttons: Save, Publish, Delete, Manage/View Items, View Quiz Results.

When managing, auto-save content progress locally and push to backend on intervals or unload.

Once published, items are view-only but still accessible.

Dashboard Changes

Add a new section labeled “Quizzes by those you know” showing quizzes shared by friends (for students).

Both draft and published quizzes by the user also appear under the “Quizzes” section.

Deleting a course automatically removes quizzes from this display.

When a student leaves or is removed from a course, hide those quizzes dynamically.

Grades

Grades persist independently of quiz or course deletion.

Organize grades per quiz — expandable/collapsible format instead of all visible at once.

Teachers and Students can both click “View Quiz Results” to open a popup showing scores and details.

🔁 Process Flow Summary

Teacher creating a quiz:
Teacher → clicks Create Quiz → fills popup → selects optional image → clicks Create → quiz saved as draft → appears in Course Management → teacher edits items → hits Publish → visible to students → grades recorded as students take it.

Student creating a quiz:
Student → clicks Create Quiz → same popup → optional image → quiz saved as draft → can edit and publish → toggle Private/Shared → shared quizzes visible to friends.

Course deletion:
Deletes all quizzes under it → Grades remain.

Student leaves a course:
Course quizzes are hidden → Grades remain.

Deleting quiz:
Quiz removed → Grades remain.

🎨 UI Design Notes

All modals and popups must include a visible Back button.

Maintain Kodchasan font and the purple-yellow-pink color palette.

Add animations and hover feedback for all buttons and cards (CSS transitions, keyframes).

Use React states to track image upload progress, autosave status, and publish state.

Ensure clean error handling with toast notifications for uploads, deletes, and saves.

💾 Storage and Infrastructure

Use AWS S3 for image uploads (both course and quiz preview images).

Store absolute URLs in the database.

Use AWS MySQL RDS for all relational data (users, courses, quizzes, grades).

Maintain existing AWS IAM policies for read/write access to quizdeck-profile-images.

🧠 Developer Notes

Refactor existing backend controllers and React components where needed, but retain compatibility with current routing and data models.

Ensure all new quiz image uploads and replacements overwrite previous S3 objects to avoid stale files.

Make sure that quiz editor auto-saves periodically and upon user exit.

Preserve the current session-based logic for teacher/student identification.

Confirm that any added toggles or quiz states persist across sessions.

Test flows for:

Quiz creation (with/without image)

Quiz deletion (draft or published)

Publishing a draft

Student leaving a course

Course deletion cascade

Image replacement

Grades display and persistence
