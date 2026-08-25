module ApplicationHelper
  # Badge background color for a reservation status.
  def reservation_status_color(status)
    case status
    when "confirmed" then "#d1fae5"
    when "cancelled" then "#fee2e2"
    else "#fef3c7"
    end
  end

  def space_kind_label(kind)
    Space::KIND_LABELS.fetch(kind, "Space")
  end
end
