<?php

namespace App\Http\Controllers;

use App\Models\Quiz;
use App\Models\QuizItem;
use App\Models\QuizAttempt;
use App\Models\QuizResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QuizAttemptController extends Controller
{
    public function start(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'quiz_id' => ['required','integer','exists:quizzes,id'],
        ]);
        $quiz = Quiz::with('items')->findOrFail($data['quiz_id']);
        // Eligibility
        if ($quiz->creator_id !== $user->id) {
            $allowed = false;
            if ($quiz->course_id) {
                $enrolled = \App\Models\Enrollment::where('user_id', $user->id)->where('course_id', $quiz->course_id)->exists();
                $allowed = $quiz->is_published && $quiz->is_available && $enrolled;
            } else {
                $friendIds = \DB::table('friends')
                    ->where(function($q) use ($user) { $q->where('user_id', $user->id)->orWhere('friend_id', $user->id); })
                    ->where('status', 'accepted')
                    ->selectRaw('CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS fid', [$user->id])
                    ->pluck('fid');
                $allowed = $quiz->is_published && $quiz->is_available && $quiz->is_shared && $friendIds->contains($quiz->creator_id);
            }
            if (!$allowed) return response()->json(['message' => 'Forbidden'], 403);
        }
        // Enforce repeatable logic
        $existing = QuizAttempt::where('quiz_id', $quiz->id)->where('student_id', $user->id)->where('is_submitted', true)->exists();
        if ($existing && !$quiz->is_repeatable) {
            return response()->json(['message' => 'Quiz is not repeatable'], 403);
        }
        $attempt = QuizAttempt::create([
            'quiz_id' => $quiz->id,
            'student_id' => $user->id,
            'total_items' => $quiz->items()->count(),
            'is_submitted' => false,
            'in_progress_data' => [],
        ]);
        return response()->json($attempt, 201);
    }

    public function autosave(Request $request, $id)
    {
        $user = $request->user();
        $attempt = QuizAttempt::findOrFail($id);
        if ($attempt->student_id !== $user->id || $attempt->is_submitted) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $data = $request->validate([
            'in_progress_data' => ['required','array'],
        ]);
        $attempt->in_progress_data = $data['in_progress_data'];
        $attempt->save();
        return response()->json(['saved' => true]);
    }

    public function submit(Request $request, $id)
    {
        $user = $request->user();
        $attempt = QuizAttempt::with('quiz','responses','quiz.items.choices')->findOrFail($id);
        if ($attempt->student_id !== $user->id || $attempt->is_submitted) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $data = $request->validate([
            'answers' => ['required','array'], // { item_id: value or [values] }
        ]);

        $quiz = Quiz::with(['items.choices'])->findOrFail($attempt->quiz_id);
        $score = 0;
        DB::transaction(function () use ($data, $quiz, $attempt, &$score) {
            // clear previous responses
            $attempt->responses()->delete();
            foreach ($quiz->items as $item) {
                $ans = $data['answers'][$item->id] ?? null;
                $isCorrect = null;
                if ($item->type === 'identification') {
                    $expected = trim(mb_strtolower((string)($item->correct_answer ?? '')));
                    $given = trim(mb_strtolower((string)($ans ?? '')));
                    $isCorrect = ($expected !== '' && $given !== '' && $expected === $given);
                } elseif (in_array($item->type, ['multiple_choice','multiple_answer','true_false'])) {
                    // multiple choice: either a single value or array of correct choices
                    $correctIds = $item->choices()->where('is_correct', true)->pluck('id')->sort()->values()->all();
                    $givenIds = is_array($ans) ? $ans : (isset($ans) ? [$ans] : []);
                    sort($givenIds);
                    $isCorrect = ($correctIds === $givenIds);
                } elseif ($item->type === 'ordering') {
                    // Expect exact sequence match to meta.order. Support either values or submitted indices companion.
                    $meta = is_array($item->meta) ? $item->meta : (array)($item->meta ?? []);
                    $expected = array_map(fn($s) => (string)$s, isset($meta['order']) && is_array($meta['order']) ? $meta['order'] : []);
                    $givenVals = is_array($ans) ? array_map(fn($s) => (string)$s, $ans) : [];
                    $isCorrect = ($expected && $givenVals && $givenVals === $expected);
                    if (!$isCorrect) {
                        // Check indices variant if provided (answers contains "{id}_indices" generated by frontend)
                        $idxKey = $item->id . '_indices';
                        $idx = $data['answers'][$idxKey] ?? null;
                        if (is_array($idx)) {
                            $range = range(0, max(0, count($expected) - 1));
                            $isCorrect = ($idx === $range);
                        }
                    }
                } elseif ($item->type === 'matching') {
                    // Expect mapping left => right to match meta.pairs exactly (case-insensitive, trimmed)
                    $meta = is_array($item->meta) ? $item->meta : (array)($item->meta ?? []);
                    $pairs = isset($meta['pairs']) && is_array($meta['pairs']) ? $meta['pairs'] : [];
                    $expectedMap = [];
                    foreach ($pairs as $p) {
                        if (is_array($p) && isset($p['left'], $p['right'])) {
                            $expectedMap[trim(mb_strtolower((string)$p['left']))] = trim(mb_strtolower((string)$p['right']));
                        } elseif (is_object($p) && isset($p->left, $p->right)) {
                            $expectedMap[trim(mb_strtolower((string)$p->left))] = trim(mb_strtolower((string)$p->right));
                        }
                    }
                    $givenMap = [];
                    if (is_array($ans)) {
                        foreach ($ans as $k => $v) {
                            $givenMap[trim(mb_strtolower((string)$k))] = trim(mb_strtolower((string)$v));
                        }
                    }
                    $isCorrect = !empty($expectedMap) && $givenMap === $expectedMap;
                }
                QuizResponse::create([
                    'attempt_id' => $attempt->id,
                    'item_id' => $item->id,
                    'selected_answer' => is_array($ans) ? json_encode($ans) : (string)($ans ?? ''),
                    'is_correct' => $isCorrect,
                ]);
                if ($isCorrect) $score++;
            }
            $attempt->score = $score;
            $attempt->total_items = $quiz->items()->count();
            $attempt->is_submitted = true;
            $attempt->save();
        });
        return response()->json($attempt->fresh('responses'));
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $attempt = QuizAttempt::with('quiz')->findOrFail($id);
        $quiz = $attempt->quiz;
        // Permission: student can delete if it's their own and not submitted; teacher owner can delete any
        $isOwnerTeacher = false;
        if ($quiz) {
            $isOwnerTeacher = ($quiz->creator_id === $user->id);
            if (!$isOwnerTeacher && $quiz->course_id) {
                $isOwnerTeacher = \DB::table('courses')->where('id', $quiz->course_id)->where('teacher_id', $user->id)->exists();
            }
        }
        $canStudent = ($attempt->student_id === $user->id) && !$attempt->is_submitted;
        if (!($isOwnerTeacher || $canStudent)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        DB::transaction(function() use ($attempt) {
            $attempt->responses()->delete();
            $attempt->delete();
        });
        return response()->json(['deleted' => true]);
    }
}
