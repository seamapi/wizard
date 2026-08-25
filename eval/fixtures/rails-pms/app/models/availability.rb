require "set"

# Availability helpers shared by booking and front-desk reassignment.
module Availability
  # A guest-readable reason a space can't take a stay.
  class BookingError < StandardError; end

  module_function

  # Space ids already held for the given range, excluding one reservation.
  #
  # Reservations hold a space for the half-open interval [check_in, check_out),
  # so a same-day turnover (one guest out, the next in) is not a conflict.
  # Cancelled reservations release the space.
  def booked_space_ids(check_in:, check_out:, exclude_reservation_id: nil)
    # ISO YYYY-MM-DD sorts lexicographically, so a text compare is a date compare.
    scope =
      Reservation
        .where.not(space_id: nil)
        .where.not(status: "cancelled")
        .where("check_in < ?", check_out)
        .where("check_out > ?", check_in)
    scope = scope.where.not(id: exclude_reservation_id) if exclude_reservation_id

    scope.distinct.pluck(:space_id).compact.to_set
  end

  # Assert a space can take a stay, raising BookingError if not.
  def assert_space_bookable(space_id:, check_in:, check_out:, party_size:, exclude_reservation_id: nil)
    space = Space.find_by(id: space_id)
    raise BookingError, "That space no longer exists." if space.nil?
    raise BookingError, "#{space.name} is archived and can't be booked." unless space.active?

    if party_size > space.capacity
      raise BookingError,
            "#{space.name} sleeps #{space.capacity}, but this stay is for #{party_size}."
    end

    booked =
      booked_space_ids(
        check_in: check_in,
        check_out: check_out,
        exclude_reservation_id: exclude_reservation_id,
      )
    raise BookingError, "#{space.name} is already booked for those dates." if booked.include?(space.id)

    space
  end

  # Active spaces annotated with whether they can take the given stay.
  def list_space_availability(check_in:, check_out:, party_size:)
    booked = booked_space_ids(check_in: check_in, check_out: check_out)

    Space
      .only_active
      .order(:name)
      .map do |space|
        if booked.include?(space.id)
          { space: space, available: false, reason: "Booked for these dates" }
        elsif party_size > space.capacity
          { space: space, available: false, reason: "Sleeps #{space.capacity}" }
        else
          { space: space, available: true, reason: nil }
        end
      end
  end
end
