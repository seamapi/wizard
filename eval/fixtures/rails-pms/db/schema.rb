# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running
# `bin/rails db:schema:load`. When creating a new database, `bin/rails db:setup`
# tends to be faster and is preferred.

ActiveRecord::Schema[7.1].define(version: 2024_01_01_000002) do
  create_table "reservations", force: :cascade do |t|
    t.string "guest_name", null: false
    t.string "email", null: false
    t.string "phone", null: false
    t.string "check_in", null: false
    t.string "check_out", null: false
    t.integer "party_size", default: 1, null: false
    t.text "notes"
    t.integer "space_id"
    t.string "status", default: "pending", null: false
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.index ["space_id"], name: "index_reservations_on_space_id"
  end

  create_table "spaces", force: :cascade do |t|
    t.string "name", null: false
    t.string "kind", default: "room", null: false
    t.integer "capacity", default: 2, null: false
    t.integer "rate_cents"
    t.string "status", default: "active", null: false
    t.text "notes"
    t.datetime "created_at", default: -> { "CURRENT_TIMESTAMP" }, null: false
    t.index ["name"], name: "index_spaces_on_name", unique: true
  end

  add_foreign_key "reservations", "spaces", on_delete: :nullify
end
