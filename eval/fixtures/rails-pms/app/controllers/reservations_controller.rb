# The front desk: list reservations, change status, assign a space, delete.
class ReservationsController < ApplicationController
  # The front-desk list, with the spaces available for reassignment.
  def index
    @reservations = Reservation.list
    @spaces = Space.list
  end

  # Update a reservation's status (front desk).
  def update_status
    reservation = Reservation.find_by(id: params[:id])
    return redirect_to(reservations_path, status: :see_other) if reservation.nil?

    new_status = params[:status].to_s
    unless Reservation::STATUSES.include?(new_status)
      return redirect_to(reservations_path, status: :see_other)
    end

    # Cancelling releases the space, so reviving a cancelled stay has to win its
    # space back — someone else may have taken it in the meantime.
    if reservation.status == "cancelled" && new_status != "cancelled" && reservation.space_id.present?
      begin
        Availability.assert_space_bookable(
          space_id: reservation.space_id,
          check_in: reservation.check_in,
          check_out: reservation.check_out,
          party_size: reservation.party_size,
          exclude_reservation_id: reservation.id,
        )
      rescue Availability::BookingError
        return redirect_to(reservations_path, status: :see_other)
      end
    end

    reservation.update!(status: new_status)
    redirect_to reservations_path, status: :see_other
  end

  # Assign, move, or clear a reservation's space (front desk).
  def assign_space
    reservation = Reservation.find_by(id: params[:id])
    return redirect_to(reservations_path, status: :see_other) if reservation.nil?

    space_id = params[:space_id].presence

    if space_id.present?
      begin
        Availability.assert_space_bookable(
          space_id: space_id.to_i,
          check_in: reservation.check_in,
          check_out: reservation.check_out,
          party_size: reservation.party_size,
          exclude_reservation_id: reservation.id,
        )
      rescue Availability::BookingError
        return redirect_to(reservations_path, status: :see_other)
      end
    end

    reservation.update!(space_id: space_id)
    redirect_to reservations_path, status: :see_other
  end

  # Delete a reservation (front desk).
  def destroy
    reservation = Reservation.find_by(id: params[:id])
    reservation&.destroy
    redirect_to reservations_path, status: :see_other
  end
end
