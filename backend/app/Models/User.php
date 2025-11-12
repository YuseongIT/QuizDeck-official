<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'role',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_verified' => 'boolean',
        'is_admin' => 'boolean',
    ];

    public function getProfileImageAttribute($value)
    {
        if (!$value) return null;
        // If already absolute, return as-is
        if (preg_match('/^https?:\/\//i', $value)) return $value;
        // Ensure leading slash
        $path = ltrim($value, '/');
        return url('/' . $path);
    }

    // Student enrolled courses relationship (matches Course::students pivot)
    public function enrolledCourses()
    {
        return $this->belongsToMany(Course::class, 'course_student', 'user_id', 'course_id')
            ->withTimestamps();
    }
}
