# A single reservation.
#
# Guest contact details are stored inline (no separate accounts / login) to keep
# the PMS minimal. Dates are ISO YYYY-MM-DD strings, which sort as dates.
class Reservation < ApplicationRecord
  STATUSES = %w[pending confirmed cancelled].freeze

  # Nullable: a stay can be taken before the front desk has decided which space
  # the guest gets. Clearing the space on delete keeps the reservation valid.
  belongs_to :space, optional: true

  validates :guest_name, presence: true
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :phone, presence: true, length: { minimum: 5 }
  validates :check_in, presence: true
  validates :check_out, presence: true
  validates :party_size,
            numericality: {
              only_integer: true,
              greater_than_or_equal_to: 1,
              less_than_or_equal_to: 20,
            }
  validates :status, inclusion: { in: STATUSES }
  validate :check_out_after_check_in

  scope :newest_first, -> { order(created_at: :desc) }

  # All reservations, newest first, with the assigned space eager-loaded.
  def self.list
    newest_first.includes(:space)
  end

  private

  def check_out_after_check_in
    return if check_in.blank? || check_out.blank?

    errors.add(:check_out, "must be after check-in") if check_out <= check_in
  end
end
