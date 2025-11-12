<?php

namespace App\Http\Controllers;

use App\Models\Quiz;
use App\Models\QuizItem;
use App\Models\QuizChoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class QuizItemController extends Controller
{
    public function index(Request $request, $quizId)
    {
        $quiz = Quiz::findOrFail($quizId);
        $user = $request->user();
        // Only owners (creator or course teacher) can fetch editable item list
        $isOwner = ($quiz->creator_id === $user->id);
        if (!$isOwner && $quiz->course_id) {
            $isOwner = \DB::table('courses')->where('id', $quiz->course_id)->where('teacher_id', $user->id)->exists();
        }
        if (!$isOwner) return response()->json(['message' => 'Forbidden'], 403);
        $items = QuizItem::where('quiz_id', $quiz->id)->with('choices')->orderBy('order_index')->get();
        $diskName = config('filesystems.default', 'public');
        // Attach absolute image_url and media_url for convenience
        $items->transform(function ($it) use ($diskName) {
            if (!empty($it->image_path)) {
                try {
                    $disk = \Storage::disk(config('filesystems.default','public'));
                    $it->image_url = $disk->url($it->image_path);
                    if (!$it->image_url && method_exists($disk, 'temporaryUrl')) {
                        $it->image_url = $disk->temporaryUrl($it->image_path, now()->addHours(6));
                    }
                } catch (\Throwable $e) { $it->image_url = null; }
            } else {
                $it->image_url = null;
            }
            if (!empty($it->media_path)) {
                try {
                    $disk = \Storage::disk(config('filesystems.default','public'));
                    $it->media_url = $disk->url($it->media_path);
                    if (!$it->media_url && method_exists($disk, 'temporaryUrl')) {
                        $it->media_url = $disk->temporaryUrl($it->media_path, now()->addHours(6));
                    }
                } catch (\Throwable $e) { $it->media_url = null; }
            } else { $it->media_url = null; }
            return $it;
        });
        return response()->json($items);
    }

    public function uploadMedia(Request $request, $id)
    {
        $item = QuizItem::findOrFail($id);
        $quiz = Quiz::findOrFail($item->quiz_id);
        $user = $request->user();
        $isOwner = ($quiz->creator_id === $user->id);
        if (!$isOwner && $quiz->course_id) {
            $isOwner = \DB::table('courses')->where('id', $quiz->course_id)->where('teacher_id', $user->id)->exists();
        }
        if (!$isOwner) return response()->json(['message' => 'Forbidden'], 403);
        $request->validate([
            'media' => ['required','file','mimetypes:audio/*,video/*','max:15360'], // 15MB
        ]);
        // delete previous
        $diskName = config('filesystems.default', 'public');
        if ($item->media_path) { try { \Storage::disk($diskName)->delete($item->media_path); } catch (\Throwable $e) {} }
        $file = $request->file('media');
        $ext = $file->getClientOriginalExtension() ?: $file->extension() ?: '';
        $filename = uniqid().($ext ? '.'.$ext : '');
        $dir = 'quiz_media/'.$item->id;
        $path = \Storage::disk($diskName)->putFileAs($dir, $file, $filename, [
            'ContentType' => $file->getMimeType() ?: 'application/octet-stream',
            'CacheControl' => 'public, max-age=31536000',
        ]);
        $item->media_path = $path;
        $item->media_type = str_starts_with($file->getMimeType(), 'video/') ? 'video' : 'audio';
        $item->save();
        $url = null;
        try { $disk = \Storage::disk($diskName); $url = $disk->url($path) ?: (method_exists($disk,'temporaryUrl') ? $disk->temporaryUrl($path, now()->addHours(6)) : null); } catch (\Throwable $__) {}
        return response()->json(['media_path'=>$path,'media_type'=>$item->media_type,'media_url'=>$url,'item'=>$item]);
    }

    public function deleteMedia(Request $request, $id)
    {
        $item = QuizItem::findOrFail($id);
        $quiz = Quiz::findOrFail($item->quiz_id);
        $user = $request->user();
        $isOwner = ($quiz->creator_id === $user->id);
        if (!$isOwner && $quiz->course_id) {
            $isOwner = \DB::table('courses')->where('id', $quiz->course_id)->where('teacher_id', $user->id)->exists();
        }
        if (!$isOwner) return response()->json(['message' => 'Forbidden'], 403);
        $diskName = config('filesystems.default', 'public');
        if ($item->media_path) { try { \Storage::disk($diskName)->delete($item->media_path); } catch (\Throwable $e) {} }
        $item->media_path = null; $item->media_type = null; $item->save();
        return response()->json(['deleted'=>true]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'quiz_id' => ['required','integer', Rule::exists('quizzes','id')],
            'type' => ['required', Rule::in(['multiple_choice','multiple_answer','true_false','identification','matching','ordering'])],
            'question' => ['required','string'],
            'correct_answer' => ['nullable','string'],
            'order_index' => ['nullable','integer','min:0'],
            'choices' => ['array'],
            'choices.*.choice_text' => ['required_with:choices','string'],
            'choices.*.is_correct' => ['boolean'],
            'meta' => ['nullable','array'],
        ]);
        $quiz = Quiz::findOrFail($data['quiz_id']);
        $isOwner = ($quiz->creator_id === $user->id);
        if (!$isOwner && $quiz->course_id) {
            $isOwner = \DB::table('courses')->where('id', $quiz->course_id)->where('teacher_id', $user->id)->exists();
        }
        if (!$isOwner) return response()->json(['message' => 'Forbidden'], 403);
        $item = QuizItem::create([
            'quiz_id' => $data['quiz_id'],
            'type' => $data['type'],
            'question' => $data['question'],
            'correct_answer' => $data['correct_answer'] ?? null,
            'order_index' => $data['order_index'] ?? 0,
        ]);
        // Save meta if provided (for matching/ordering etc.)
        if (isset($data['meta'])) {
            $item->meta = $data['meta'];
            $item->save();
        }
        // Normalize choices for types
        if (in_array($data['type'], ['multiple_choice','multiple_answer','true_false']) && isset($data['choices'])) {
            // Enforce single correct for multiple_choice/true_false
            if (in_array($data['type'], ['multiple_choice','true_false'])) {
                $oneMarked = false;
                foreach ($data['choices'] as &$c) {
                    $c['is_correct'] = !$oneMarked && !empty($c['is_correct']);
                    if ($c['is_correct']) { $oneMarked = true; }
                }
                unset($c);
            }
            foreach ($data['choices'] as $c) {
                QuizChoice::create([
                    'item_id' => $item->id,
                    'choice_text' => $c['choice_text'],
                    'is_correct' => (bool)($c['is_correct'] ?? false),
                ]);
            }
        } elseif ($data['type'] === 'true_false') {
            // Auto-create TF choices if none provided
            $correctTrue = strtolower((string)($data['correct_answer'] ?? 'false')) === 'true';
            foreach ([["True",$correctTrue], ["False",!$correctTrue]] as [$txt,$is]) {
                QuizChoice::create(['item_id'=>$item->id,'choice_text'=>$txt,'is_correct'=>$is]);
            }
        }
        return response()->json($item->load('choices'), 201);
    }

    public function update(Request $request, $id)
    {
        $item = QuizItem::with('choices')->findOrFail($id);
        $quiz = Quiz::findOrFail($item->quiz_id);
        $user = $request->user();
        $isOwner = ($quiz->creator_id === $user->id);
        if (!$isOwner && $quiz->course_id) {
            $isOwner = \DB::table('courses')->where('id', $quiz->course_id)->where('teacher_id', $user->id)->exists();
        }
        if (!$isOwner) return response()->json(['message' => 'Forbidden'], 403);
        $data = $request->validate([
            'type' => ['sometimes', Rule::in(['multiple_choice','multiple_answer','true_false','identification','matching','ordering'])],
            'question' => ['sometimes','string'],
            'correct_answer' => ['nullable','string'],
            'order_index' => ['nullable','integer','min:0'],
            'choices' => ['array'],
            'choices.*.id' => ['nullable','integer'],
            'choices.*.choice_text' => ['required_with:choices','string'],
            'choices.*.is_correct' => ['boolean'],
            'meta' => ['nullable','array'],
        ]);
        $item->fill($data)->save();
        if (array_key_exists('meta', $data)) { $item->meta = $data['meta']; $item->save(); }
        if (isset($data['choices'])) {
            // replace choices set for simplicity
            $item->choices()->delete();
            // Enforce single correct for multiple_choice/true_false
            if (in_array($item->type, ['multiple_choice','true_false'])) {
                $oneMarked = false;
                foreach ($data['choices'] as &$c) {
                    $c['is_correct'] = !$oneMarked && !empty($c['is_correct']);
                    if ($c['is_correct']) { $oneMarked = true; }
                }
                unset($c);
            }
            foreach ($data['choices'] as $c) {
                QuizChoice::create([
                    'item_id' => $item->id,
                    'choice_text' => $c['choice_text'],
                    'is_correct' => (bool)($c['is_correct'] ?? false),
                ]);
            }
        }
        $item = $item->load('choices');
        // attach absolute image_url/media_url similar to index
        try {
            $disk = \Storage::disk(config('filesystems.default','public'));
            $item->image_url = $item->image_path ? ($disk->url($item->image_path) ?: (method_exists($disk,'temporaryUrl') ? $disk->temporaryUrl($item->image_path, now()->addHours(6)) : null)) : null;
            $item->media_url = $item->media_path ? ($disk->url($item->media_path) ?: (method_exists($disk,'temporaryUrl') ? $disk->temporaryUrl($item->media_path, now()->addHours(6)) : null)) : null;
        } catch (\Throwable $__) { $item->image_url = null; }
        return response()->json($item);
    }

    public function destroy(Request $request, $id)
    {
        $item = QuizItem::findOrFail($id);
        $quiz = Quiz::findOrFail($item->quiz_id);
        $user = $request->user();
        $isOwner = ($quiz->creator_id === $user->id);
        if (!$isOwner && $quiz->course_id) {
            $isOwner = \DB::table('courses')->where('id', $quiz->course_id)->where('teacher_id', $user->id)->exists();
        }
        if (!$isOwner) return response()->json(['message' => 'Forbidden'], 403);
        // delete image on S3 if present
        $diskName = config('filesystems.default', 'public');
        if ($item->image_path) {
            try { Storage::disk($diskName)->delete($item->image_path); } catch (\Throwable $e) {}
        }
        $item->delete();
        return response()->json(['deleted' => true]);
    }

    public function uploadImage(Request $request, $id)
    {
        $item = QuizItem::findOrFail($id);
        $quiz = Quiz::findOrFail($item->quiz_id);
        $user = $request->user();
        $isOwner = ($quiz->creator_id === $user->id);
        if (!$isOwner && $quiz->course_id) {
            $isOwner = \DB::table('courses')->where('id', $quiz->course_id)->where('teacher_id', $user->id)->exists();
        }
        if (!$isOwner) return response()->json(['message' => 'Forbidden'], 403);
        $request->validate([
            'image' => ['required','file','image','max:5120'],
        ]);
        if ($item->image_path) {
            try { Storage::disk('s3')->delete($item->image_path); } catch (\Throwable $e) {}
        }
        $file = $request->file('image');
        $ext = $file->getClientOriginalExtension();
        if (!$ext) {
            $ext = $file->extension() ?: 'jpg';
        }
        $filename = uniqid().'.'.$ext;
        // Store under quiz_images/{item_id}/{filename}
        $dir = 'quiz_images/'.$item->id;
        $diskName = config('filesystems.default', 'public');
        // Some S3 setups block public ACLs; avoid setting visibility here
        $options = [
            'ContentType' => $file->getMimeType() ?: 'image/'.$ext,
            'CacheControl' => 'public, max-age=31536000',
        ];
        $path = Storage::disk($diskName)->putFileAs($dir, $file, $filename, $options);
        $item->image_path = $path;
        $item->save();
        $url = null;
        try {
            $disk = Storage::disk($diskName);
            $url = $disk->url($path);
            if (!$url && method_exists($disk, 'temporaryUrl')) {
                $url = $disk->temporaryUrl($path, now()->addHours(6));
            }
        } catch (\Throwable $__) {}
        return response()->json(['image_path' => $path, 'image_url' => $url, 'item' => $item]);
    }

    public function deleteImage(Request $request, $id)
    {
        $item = QuizItem::findOrFail($id);
        $quiz = Quiz::findOrFail($item->quiz_id);
        $user = $request->user();
        $isOwner = ($quiz->creator_id === $user->id);
        if (!$isOwner && $quiz->course_id) {
            $isOwner = \DB::table('courses')->where('id', $quiz->course_id)->where('teacher_id', $user->id)->exists();
        }
        if (!$isOwner) return response()->json(['message' => 'Forbidden'], 403);
        $diskName = config('filesystems.default', 'public');
        if ($item->image_path) {
            try { Storage::disk($diskName)->delete($item->image_path); } catch (\Throwable $e) {}
            $item->image_path = null;
            $item->save();
        }
        return response()->json(['deleted' => true]);
    }
}
