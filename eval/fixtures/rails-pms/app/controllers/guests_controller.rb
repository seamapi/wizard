# The derived guests page (reservations deduped by email).
class GuestsController < ApplicationController
  def index
    @guests = Guest.list
  end
end
