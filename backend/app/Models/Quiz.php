<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Quiz extends Model
{
    use HasFactory;

    protected $fillable = [
        'title','description','course_id','creator_id','visibility','is_published','is_repeatable','is_shared','is_available'
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function items()
    {
        return $this->hasMany(QuizItem::class);
    }

    public function attempts()
    {
        return $this->hasMany(QuizAttempt::class);
    }
}
