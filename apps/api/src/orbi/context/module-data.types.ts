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

export interface ClientesSnapshot {
  totalCustomers:    number;
  newThisMonth:      number;
  segmentation:      { vip: number; recurrent: number; new: number; inactive: number };
  topCustomerName:   string | null;
}

export interface CatalogoSnapshot {
  totalProducts:     number;
  publishedProducts: number;
  draftProducts:     number;
  outOfStock:        number;
  totalCategories:   number;
  emptyCategories:   number;
  avgPrice:          number;
}

export interface MensajesSnapshot {
  unreadCount:          number;
  totalConversations:   number;
  avgResponseTimeHours: number | null;
}

export type ModuleSnapshot = DashboardSnapshot | PedidosSnapshot | ClientesSnapshot | CatalogoSnapshot | MensajesSnapshot | Record<string, never>;
