# Seed a few spaces the first time so the booking form's picker isn't empty on
# a fresh clone. Idempotent: only seeds when there are no spaces yet.
if Space.count.zero?
  Space.create!(
    name: "Seagrass Suite",
    kind: "suite",
    capacity: 4,
    rate_cents: 24_000,
    notes: "Ocean view, walk-in shower",
  )
  Space.create!(name: "Dune Cabin", kind: "cabin", capacity: 2, rate_cents: 16_000)
  Space.create!(name: "Harbor Room 101", kind: "room", capacity: 2, rate_cents: 12_000)
end
