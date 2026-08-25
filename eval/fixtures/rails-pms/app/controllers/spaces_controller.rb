# Space inventory: create, edit, and archive/restore bookable spaces.
class SpacesController < ApplicationController
  def index
    @spaces = Space.list
    @kinds = Space::KINDS
    @error = nil
    render :index
  end

  def create
    space = Space.new(space_params)
    if space.save
      redirect_to spaces_path, status: :see_other
    else
      render_spaces_error(space)
    end
  end

  def update
    space = Space.find_by(id: params[:id])
    return redirect_to(spaces_path, status: :see_other) if space.nil?

    if space.update(space_params)
      redirect_to spaces_path, status: :see_other
    else
      render_spaces_error(space)
    end
  end

  # Archive or restore a space. Archiving keeps it out of the booking picker
  # without touching the reservations that already reference it.
  def set_status
    space = Space.find_by(id: params[:id])
    if space
      new_status = params[:status].to_s
      space.update!(status: new_status) if Space::STATUSES.include?(new_status)
    end
    redirect_to spaces_path, status: :see_other
  end

  private

  def space_params
    permitted = params.permit(:name, :kind, :capacity, :rate, :notes)

    kind = permitted[:kind].presence || "room"
    kind = "room" unless Space::KINDS.include?(kind)

    # Nightly rate is entered in whole currency units; store integer cents.
    rate = permitted[:rate].presence

    {
      name: permitted[:name].to_s,
      kind: kind,
      capacity: permitted[:capacity].presence || 2,
      rate_cents: rate.nil? ? nil : (rate.to_f * 100).round,
      notes: permitted[:notes].presence,
    }
  end

  def render_spaces_error(space)
    @spaces = Space.list
    @kinds = Space::KINDS
    @error = friendly_space_error(space)
    render :index, status: :unprocessable_entity
  end

  # Names are unique, so surface the collision instead of a raw database error.
  def friendly_space_error(space)
    if space.errors.of_kind?(:name, :taken)
      "A space named “#{space.name}” already exists."
    else
      space.errors.full_messages.first || "That space looks invalid."
    end
  end
end
