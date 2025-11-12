<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Course extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'description', 'course_code', 'course_id', 'is_public', 'image_url', 'teacher_id', 'teacher_email'
    ];

    public function teacher() { return $this->belongsTo(User::class, 'teacher_id'); }
    public function students() { return $this->belongsToMany(User::class, 'course_student')->withPivot('enrolled_at')->withTimestamps(); }
    public function announcements() { return $this->hasMany(Announcement::class); }

    // Scopes
    public function scopePublic($q) { return $q->where('is_public', true); }

    protected static function booted()
    {
        static::deleting(function (Course $course) {
            // detach students and remove announcements
            $course->students()->detach();
            $course->announcements()->delete();
            // best-effort image cleanup (optional)
            if ($course->image_url && str_starts_with((string)$course->image_url, 's3://')) {
                try { Storage::disk('s3')->delete(parse_url($course->image_url, PHP_URL_PATH)); } catch (\Throwable $e) {}
            }
        });
    }
}
