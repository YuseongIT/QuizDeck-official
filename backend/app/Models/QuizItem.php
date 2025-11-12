<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class QuizItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'quiz_id','type','question','correct_answer','image_path','order_index','meta','media_path','media_type'
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function quiz() { return $this->belongsTo(Quiz::class); }
    public function choices() { return $this->hasMany(QuizChoice::class, 'item_id'); }
}
