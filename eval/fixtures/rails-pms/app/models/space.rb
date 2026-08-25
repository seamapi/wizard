# A bookable space (room, suite, cabin…).
#
# Spaces are archived rather than deleted so past reservations keep pointing at
# something real.
class Space < ApplicationRecord
  # The kinds of bookable space a property can offer, plus their display labels.
  KINDS = %w[room suite cabin villa tent other].freeze
  KIND_LABELS = {
    "room" => "Room",
    "suite" => "Suite",
    "cabin" => "Cabin",
    "villa" => "Villa",
    "tent" => "Tent",
    "other" => "Space",
  }.freeze

  STATUSES = %w[active archived].freeze

  has_many :reservations, dependent: :nullify

  validates :name, presence: true, uniqueness: true, length: { maximum: 80 }
  validates :kind, inclusion: { in: KINDS }
  validates :capacity,
            numericality: {
              only_integer: true,
              greater_than_or_equal_to: 1,
              less_than_or_equal_to: 40,
            }
  validates :status, inclusion: { in: STATUSES }

  scope :only_active, -> { where(status: "active") }

  # Every space, active first then alphabetical.
  def self.list
    order(Arel.sql("status ASC"), Arel.sql("name ASC"))
  end

  def active?
    status == "active"
  end

  def kind_label
    KIND_LABELS.fetch(kind, "Space")
  end
end
