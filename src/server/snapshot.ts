import { EMPTY_APP_STATE, type AppState } from "@/lib/app-state";
import { withClient } from "./db";
import {
  groupBy,
  mapAudit,
  mapBrand,
  mapCashSession,
  mapCategory,
  mapCommune,
  mapCompany,
  mapCustomer,
  mapDelivery,
  mapDriver,
  mapExpense,
  mapMovement,
  mapNotification,
  mapOrder,
  mapOrderEvent,
  mapOrderItem,
  mapPoste,
  mapProduct,
  mapPurchaseItem,
  mapPurchaseOrder,
  mapSale,
  mapSaleItem,
  mapSupplier,
  mapTransaction,
  mapUser,
  mapVariant,
  mapZone,
} from "./map";
import type { Permission, ProductVariant } from "@/types";

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export async function loadAppState(): Promise<AppState> {
  return withClient(async (client) => {
    const result = await client.query<{ snap: Record<string, unknown> }>(`
      select jsonb_build_object(
        'company', (select to_jsonb(t) from company_settings t where id = 'company' limit 1),
        'postes', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from postes order by name) t),
        'users', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from users order by created_at) t),
        'perms', (select coalesce(jsonb_agg(t), '[]'::jsonb) from user_permissions t),
        'drivers', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from delivery_drivers order by full_name) t),
        'driverZones', (select coalesce(jsonb_agg(t), '[]'::jsonb) from delivery_driver_zones t),
        'categories', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from categories order by name) t),
        'brands', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from brands order by name) t),
        'suppliers', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from suppliers order by name) t),
        'products', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from products order by created_at desc) t),
        'variants', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from product_variants order by sku) t),
        'customers', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from customers order by created_at desc) t),
        'orders', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from orders order by created_at desc limit 400) t),
        'orderItems', (
          select coalesce(jsonb_agg(i), '[]'::jsonb) from order_items i
          where i.order_id in (select id from orders order by created_at desc limit 400)
        ),
        'orderEvents', (
          select coalesce(jsonb_agg(e), '[]'::jsonb) from order_events e
          where e.order_id in (select id from orders order by created_at desc limit 400)
        ),
        'deliveries', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from deliveries order by created_at desc limit 200) t),
        'sales', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from sales order by created_at desc limit 300) t),
        'saleItems', (
          select coalesce(jsonb_agg(i), '[]'::jsonb) from sale_items i
          where i.sale_id in (select id from sales order by created_at desc limit 300)
        ),
        'movements', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from stock_movements order by created_at desc limit 200) t),
        'purchaseOrders', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from purchase_orders order by created_at desc limit 100) t),
        'poItems', (select coalesce(jsonb_agg(t), '[]'::jsonb) from purchase_items t),
        'expenses', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from expenses order by created_at desc limit 200) t),
        'transactions', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from financial_transactions order by created_at desc limit 200) t),
        'cashSessions', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from cash_sessions order by opened_at desc limit 50) t),
        'notifications', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from notifications order by created_at desc limit 80) t),
        'auditLogs', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from audit_logs order by created_at desc limit 80) t),
        'communes', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from communes order by name) t),
        'zones', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select * from delivery_zones order by commune_id, name) t)
      ) as snap
    `);

    const snap = result.rows[0]?.snap ?? {};
    const perms = rows(snap.perms);
    const driverZones = rows(snap.driverZones);
    const variants = rows(snap.variants);
    const orderItems = rows(snap.orderItems);
    const orderEvents = rows(snap.orderEvents);
    const saleItems = rows(snap.saleItems);
    const poItems = rows(snap.poItems);

    const extraByUser = new Map<string, Permission[]>();
    for (const row of perms) {
      const uid = String(row.user_id);
      const list = extraByUser.get(uid) ?? [];
      list.push(String(row.permission) as Permission);
      extraByUser.set(uid, list);
    }

    const zonesByDriver = new Map<string, string[]>();
    for (const row of driverZones) {
      const did = String(row.driver_id);
      const list = zonesByDriver.get(did) ?? [];
      list.push(String(row.zone_id));
      zonesByDriver.set(did, list);
    }

    const variantsByProduct = groupBy(variants, "product_id");
    const itemsByOrder = groupBy(orderItems, "order_id");
    const eventsByOrder = groupBy(orderEvents, "order_id");
    const itemsBySale = groupBy(saleItems, "sale_id");
    const itemsByPo = groupBy(poItems, "purchase_order_id");
    const companyRow = snap.company as Record<string, unknown> | null;

    return {
      company: companyRow ? mapCompany(companyRow) : EMPTY_APP_STATE.company,
      postes: rows(snap.postes).map(mapPoste),
      users: rows(snap.users).map((row) => mapUser(row, extraByUser.get(String(row.id)) ?? [])),
      drivers: rows(snap.drivers).map((row) => mapDriver(row, zonesByDriver.get(String(row.id)) ?? [])),
      categories: rows(snap.categories).map(mapCategory),
      brands: rows(snap.brands).map(mapBrand),
      suppliers: rows(snap.suppliers).map(mapSupplier),
      products: rows(snap.products).map((row) => {
        const list: ProductVariant[] = (variantsByProduct.get(String(row.id)) ?? []).map(mapVariant);
        return mapProduct(row, list);
      }),
      customers: rows(snap.customers).map(mapCustomer),
      orders: rows(snap.orders).map((row) =>
        mapOrder(
          row,
          (itemsByOrder.get(String(row.id)) ?? []).map(mapOrderItem),
          (eventsByOrder.get(String(row.id)) ?? []).map(mapOrderEvent),
        ),
      ),
      deliveries: rows(snap.deliveries).map(mapDelivery),
      sales: rows(snap.sales).map((row) => mapSale(row, (itemsBySale.get(String(row.id)) ?? []).map(mapSaleItem))),
      movements: rows(snap.movements).map(mapMovement),
      purchaseOrders: rows(snap.purchaseOrders).map((row) =>
        mapPurchaseOrder(row, (itemsByPo.get(String(row.id)) ?? []).map(mapPurchaseItem)),
      ),
      expenses: rows(snap.expenses).map(mapExpense),
      transactions: rows(snap.transactions).map(mapTransaction),
      cashSessions: rows(snap.cashSessions).map(mapCashSession),
      notifications: rows(snap.notifications).map(mapNotification),
      auditLogs: rows(snap.auditLogs).map(mapAudit),
      communes: rows(snap.communes).map(mapCommune),
      zones: rows(snap.zones).map(mapZone),
    };
  });
}
