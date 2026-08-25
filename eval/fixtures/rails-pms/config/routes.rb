Rails.application.routes.draw do
  # Public booking flow.
  root "bookings#index"
  post "/book", to: "bookings#create", as: :book

  # Front desk.
  get "/reservations", to: "reservations#index", as: :reservations
  post "/reservations/:id/status", to: "reservations#update_status", as: :status_reservation
  post "/reservations/:id/assign", to: "reservations#assign_space", as: :assign_reservation
  post "/reservations/:id/delete", to: "reservations#destroy", as: :reservation

  # Space inventory.
  get "/spaces", to: "spaces#index", as: :spaces
  post "/spaces", to: "spaces#create"
  post "/spaces/:id", to: "spaces#update", as: :space
  post "/spaces/:id/status", to: "spaces#set_status", as: :status_space

  # Derived guests view.
  get "/guests", to: "guests#index", as: :guests
end
