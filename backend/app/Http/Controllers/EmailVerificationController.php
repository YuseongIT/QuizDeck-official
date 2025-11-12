<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;
use App\Models\User;
use App\Mail\VerifyEmail;

class EmailVerificationController extends Controller
{
    public function send(Request $request)
    {
        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthorized'], 401);

        if ($user->is_verified) {
            return response()->json(['message' => 'Already verified'], 200);
        }

        $expires = now()->addMinutes(60);
        $signedUrl = URL::temporarySignedRoute(
            'verification.verify',
            $expires,
            ['id' => $user->getKey()]
        );

        try {
            Mail::to($user->email)->send(new VerifyEmail($user, $signedUrl));
        } catch (\Throwable $e) {
            Log::error('Failed to send verification email', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to send verification email. Please try again later.'], 500);
        }

        return response()->json(['message' => 'Verification email sent']);
    }

    public function verify(Request $request, $id)
    {
        if (!$request->hasValidSignature()) {
            return $this->redirectWithStatus(false, 'expired');
        }

        $user = User::find($id);
        if (!$user) {
            return $this->redirectWithStatus(false, 'invalid');
        }

        if (!$user->is_verified) {
            $user->is_verified = true;
            if (empty($user->email_verified_at)) {
                $user->email_verified_at = now();
            }
            $user->save();
        }

        return $this->redirectWithStatus(true, null);
    }

    protected function redirectWithStatus(bool $ok, ?string $reason)
    {
        $base = rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/');
        $qs = $ok ? 'verified=1' : ('verified=0' . ($reason ? '&reason=' . urlencode($reason) : ''));
        $target = $base . '/settings?' . $qs;
        return redirect()->away($target);
    }
}
