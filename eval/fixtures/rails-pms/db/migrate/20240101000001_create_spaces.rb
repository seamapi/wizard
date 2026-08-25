class CreateSpaces < ActiveRecord::Migration[7.1]
  def change
    create_table :spaces do |t|
      t.string :name, null: false
      t.string :kind, null: false, default: "room"
      t.integer :capacity, null: false, default: 2
      t.integer :rate_cents
      t.string :status, null: false, default: "active"
      t.text :notes
      t.datetime :created_at, null: false, default: -> { "CURRENT_TIMESTAMP" }
    end

    add_index :spaces, :name, unique: true
  end
end
