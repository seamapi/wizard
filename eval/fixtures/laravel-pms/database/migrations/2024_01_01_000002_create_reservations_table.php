<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A single reservation. Guest contact details are stored inline (no separate
 * accounts / login) to keep the PMS minimal.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();

            // Guest / user data.
            $table->string('guest_name');
            $table->string('email');
            $table->string('phone');

            // Stay details. Dates are ISO YYYY-MM-DD strings, which sort as dates.
            $table->string('check_in');
            $table->string('check_out');
            $table->integer('party_size')->default(1);
            $table->text('notes')->nullable();

            // Assigned space. Nullable: a stay can be taken before the front desk
            // has decided which space the guest gets. Clearing the space on delete
            // keeps the reservation row valid.
            $table->foreignId('space_id')
                ->nullable()
                ->constrained('spaces')
                ->nullOnDelete();

            // Lifecycle.
            $table->string('status')->default('pending');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservations');
    }
};
