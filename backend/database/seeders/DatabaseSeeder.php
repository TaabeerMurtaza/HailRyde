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
            ['name' => 'Bilal Ahmed', 'email' => 'economy1@hailryde.test', 'phone' => '03000000002', 'role' => 'driver', 'plate' => 'LEA-1001', 'category' => 'economy', 'status' => 'available', 'lat' => '33.561778', 'lng' => '73.148275'],
            ['name' => 'Sana Iqbal', 'email' => 'economy2@hailryde.test', 'phone' => '03000000003', 'role' => 'driver', 'plate' => 'LEA-1002', 'category' => 'economy', 'status' => 'available', 'lat' => '33.590000', 'lng' => '73.140000'],
            ['name' => 'Hassan Raza', 'email' => 'comfort1@hailryde.test', 'phone' => '03000000004', 'role' => 'driver', 'plate' => 'LEA-2001', 'category' => 'comfort', 'status' => 'available', 'lat' => '33.545000', 'lng' => '73.175000'],
            ['name' => 'Maria Qureshi', 'email' => 'comfort2@hailryde.test', 'phone' => '03000000005', 'role' => 'driver', 'plate' => 'LEA-2002', 'category' => 'comfort', 'status' => 'available', 'lat' => '33.568500', 'lng' => '73.160000'],
            ['name' => 'Omar Farooq', 'email' => 'offline@hailryde.test', 'phone' => '03000000006', 'role' => 'driver', 'plate' => 'LEA-1003', 'category' => 'economy', 'status' => 'offline', 'lat' => '33.552000', 'lng' => '73.120000'],
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
