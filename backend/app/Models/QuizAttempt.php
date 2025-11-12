<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuizAttempt extends Model
{
    use HasFactory;

    protected $fillable = [
        'quiz_id','student_id','score','total_items','is_submitted','in_progress_data'
    ];

    protected $casts = [
        'in_progress_data' => 'array',
        'is_submitted' => 'boolean',
    ];

    public function quiz() { return $this->belongsTo(Quiz::class); }
    public function student() { return $this->belongsTo(User::class, 'student_id'); }
    public function responses() { return $this->hasMany(QuizResponse::class, 'attempt_id'); }
}
