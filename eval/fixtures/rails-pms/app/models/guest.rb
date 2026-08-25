# A derived view of a guest: reservations deduped by lowercased email, keeping
# the latest contact details and a count. Not an Active Record model — there is
# no guests table; guests are computed from reservations.
class Guest
  attr_reader :name, :email, :phone
  attr_accessor :reservation_count

  def initialize(name:, email:, phone:, reservation_count:)
    @name = name
    @email = email
    @phone = phone
    @reservation_count = reservation_count
  end

  # Unique guests (deduped by email), with how many reservations each has.
  def self.list
    by_email = {}

    Reservation.newest_first.each do |reservation|
      key = reservation.email.to_s.strip.downcase
      existing = by_email[key]

      if existing
        existing.reservation_count += 1
      else
        # rows are newest-first, so the first hit is the guest's latest details
        by_email[key] = new(
          name: reservation.guest_name,
          email: reservation.email,
          phone: reservation.phone,
          reservation_count: 1,
        )
      end
    end

    by_email.values
  end
end
