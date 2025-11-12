<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuizResponse extends Model
{
    use HasFactory;

    protected $fillable = [
        'attempt_id','item_id','selected_answer','is_correct'
    ];

    public function attempt() { return $this->belongsTo(QuizAttempt::class, 'attempt_id'); }
    public function item() { return $this->belongsTo(QuizItem::class, 'item_id'); }
}
