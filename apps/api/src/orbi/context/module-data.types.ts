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

export type ModuleSnapshot = DashboardSnapshot | Record<string, never>;
