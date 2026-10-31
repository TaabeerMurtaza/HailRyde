<?php

namespace App\Exceptions;

use Exception;

class RideNotFoundException extends Exception
{
    public function __construct()
    {
        parent::__construct('Not found.');
    }
}
