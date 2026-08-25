# The public booking flow: the landing page and the form that creates a stay.
class BookingsController < ApplicationController
  # The landing page with the booking form and the list of active spaces.
  def index
    @spaces = Space.only_active.order(:name)
    @error = nil
    render :index
  end

  # Create a reservation from the public booking form.
  def create
    reservation = Reservation.new(booking_params)

    unless reservation.valid?
      return render_home_error(
        reservation.errors.full_messages.first || "That booking looks invalid.",
        :unprocessable_entity,
      )
    end

    if reservation.space_id.present?
      begin
        Availability.assert_space_bookable(
          space_id: reservation.space_id,
          check_in: reservation.check_in,
          check_out: reservation.check_out,
          party_size: reservation.party_size,
        )
      rescue Availability::BookingError => error
        return render_home_error(error.message, :conflict)
      end
    end

    reservation.save!
    redirect_to reservations_path, status: :see_other
  end

  private

  def booking_params
    permitted =
      params.permit(
        :guest_name,
        :email,
        :phone,
        :check_in,
        :check_out,
        :party_size,
        :notes,
        :space_id,
      )

    {
      guest_name: permitted[:guest_name].to_s,
      email: permitted[:email].to_s,
      phone: permitted[:phone].to_s,
      check_in: permitted[:check_in].to_s,
      check_out: permitted[:check_out].to_s,
      # Default to 1 guest when the field is blank.
      party_size: permitted[:party_size].presence || 1,
      notes: permitted[:notes].presence,
      # Blank = let the front desk assign a space later.
      space_id: permitted[:space_id].presence,
    }
  end

  def render_home_error(message, status)
    @spaces = Space.only_active.order(:name)
    @error = message
    render :index, status: status
  end
end
