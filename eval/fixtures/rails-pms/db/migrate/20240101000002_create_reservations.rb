class CreateReservations < ActiveRecord::Migration[7.1]
  def change
    create_table :reservations do |t|
      # Guest / user data.
      t.string :guest_name, null: false
      t.string :email, null: false
      t.string :phone, null: false

      # Stay details. Dates are ISO YYYY-MM-DD strings, which sort as dates.
      t.string :check_in, null: false
      t.string :check_out, null: false
      t.integer :party_size, null: false, default: 1
      t.text :notes

      # Assigned space (nullable). Clearing the space on delete keeps the
      # reservation row valid.
      t.references :space, foreign_key: { on_delete: :nullify }, null: true

      # Lifecycle.
      t.string :status, null: false, default: "pending"
      t.datetime :created_at, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end
  end
end
