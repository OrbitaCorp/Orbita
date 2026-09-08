export interface DashboardSnapshot {
  salesThisMonth:       { total: number; count: number; avgTicket: number };
  salesLastMonth:       { total: number; count: number };
  pendingOrders:        number;
  cancelledThisMonth:   number;
  totalProducts:        number;
  outOfStockProducts:   number;
  totalCustomers:       number;
  newCustomersThisMonth: number;
  unreadMessages:       number;
}

export interface PedidosSnapshot {
  countByStatus:       Record<string, number>;
  oldestPendingHours:  number | null;
  avgTicketThisMonth:  number;
  lastOrderDate:       string | null;
  topPaymentMethod:    string | null;
}

export type ModuleSnapshot = DashboardSnapshot | PedidosSnapshot | Record<string, never>;
