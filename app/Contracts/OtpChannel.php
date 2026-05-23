<?php

namespace App\Contracts;

interface OtpChannel
{
    /**
     * Deliver the OTP code to the phone via this channel.
     * Returns true if the gateway accepted the request, false on any failure.
     */
    public function send(string $phone, string $code): bool;
}
