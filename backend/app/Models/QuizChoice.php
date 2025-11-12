<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuizChoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'item_id','choice_text','is_correct'
    ];

    public function item() { return $this->belongsTo(QuizItem::class, 'item_id'); }
}
