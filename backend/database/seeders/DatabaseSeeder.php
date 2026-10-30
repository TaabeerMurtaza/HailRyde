<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the local demo accounts. Every password is "password".
     */
    public function run(): void
    {
        $accounts = [
            ['name' => 'Ayesha Khan', 'email' => 'rider@hailryde.test', 'phone' => '03000000001', 'role' => 'rider'],
            ['name' => 'Bilal Ahmed', 'email' => 'economy1@hailryde.test', 'phone' => '03000000002', 'role' => 'driver', 'plate' => 'LEA-1001', 'category' => 'economy', 'status' => 'available', 'lat' => '31.520400', 'lng' => '74.358700'],
            ['name' => 'Sana Iqbal', 'email' => 'economy2@hailryde.test', 'phone' => '03000000003', 'role' => 'driver', 'plate' => 'LEA-1002', 'category' => 'economy', 'status' => 'available', 'lat' => '31.469700', 'lng' => '74.272800'],
            ['name' => 'Hassan Raza', 'email' => 'comfort1@hailryde.test', 'phone' => '03000000004', 'role' => 'driver', 'plate' => 'LEA-2001', 'category' => 'comfort', 'status' => 'available', 'lat' => '31.461800', 'lng' => '74.406600'],
            ['name' => 'Maria Qureshi', 'email' => 'comfort2@hailryde.test', 'phone' => '03000000005', 'role' => 'driver', 'plate' => 'LEA-2002', 'category' => 'comfort', 'status' => 'available', 'lat' => '31.521600', 'lng' => '74.403600'],
            ['name' => 'Omar Farooq', 'email' => 'offline@hailryde.test', 'phone' => '03000000006', 'role' => 'driver', 'plate' => 'LEA-1003', 'category' => 'economy', 'status' => 'offline', 'lat' => '31.483600', 'lng' => '74.316600'],
        ];

        foreach ($accounts as $account) {
            $user = User::query()->updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'phone' => $account['phone'],
                    'role' => $account['role'],
                    'password' => 'password',
                ],
            );

            if ($account['role'] !== 'driver') {
                $user->driverProfile()?->delete();

                continue;
            }

            $user->driverProfile()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'plate' => $account['plate'],
                    'category' => $account['category'],
                    'status' => $account['status'],
                    'lat' => $account['lat'],
                    'lng' => $account['lng'],
                ],
            );
        }
    }
}
