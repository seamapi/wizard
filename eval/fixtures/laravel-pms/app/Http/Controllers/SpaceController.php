<?php

namespace App\Http\Controllers;

use App\Models\Space;
use App\SpaceKinds;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Space inventory: create, edit, and archive/restore bookable spaces.
 */
class SpaceController extends Controller
{
    public function index(): View
    {
        $spaces = Space::query()
            ->orderBy('status')
            ->orderBy('name')
            ->get();

        return view('spaces', [
            'spaces' => $spaces,
            'kinds' => SpaceKinds::KINDS,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        Space::create($this->toRow($data));

        return redirect('/spaces');
    }

    public function update(Request $request, Space $space): RedirectResponse
    {
        $data = $this->validated($request, $space->id);

        $space->update($this->toRow($data));

        return redirect('/spaces');
    }

    /**
     * Archive or restore a space. Archiving keeps it out of the booking picker
     * without touching the reservations that already reference it.
     */
    public function setStatus(Request $request, Space $space): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:active,archived'],
        ]);

        $space->update(['status' => $data['status']]);

        return redirect('/spaces');
    }

    /**
     * Validate the create / edit form. Names are unique, so the collision is
     * surfaced as a friendly message instead of a raw database error.
     *
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate(
            [
                'name' => [
                    'required', 'string', 'max:80',
                    Rule::unique('spaces', 'name')->ignore($ignoreId),
                ],
                'kind' => ['required', Rule::in(SpaceKinds::KINDS)],
                'capacity' => ['integer', 'min:1', 'max:40'],
                'rate' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
                'notes' => ['nullable', 'string', 'max:500'],
            ],
            [
                'name.unique' => 'A space named “:input” already exists.',
            ],
        );
    }

    /**
     * Column values for a Space, converting the rate to integer cents.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function toRow(array $data): array
    {
        $rate = $data['rate'] ?? null;

        return [
            'name' => $data['name'],
            'kind' => $data['kind'],
            'capacity' => (int) ($data['capacity'] ?? 2),
            'rate_cents' => $rate === null ? null : (int) round(((float) $rate) * 100),
            'notes' => $data['notes'] ?? null,
        ];
    }
}
