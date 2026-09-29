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

export async function loadAppState(): Promise<AppState> {
  return withClient(async (client) => {
    const q = async (text: string) => (await client.query(text)).rows;

    const companyRows = await q("select * from company_settings where id = 'company' limit 1");
    const postes = await q("select * from postes order by name");
    const users = await q("select * from users order by created_at");
    const perms = await q("select user_id, permission from user_permissions");
    const drivers = await q("select * from delivery_drivers order by full_name");
    const driverZones = await q("select driver_id, zone_id from delivery_driver_zones");
    const categories = await q("select * from categories order by name");
    const brands = await q("select * from brands order by name");
    const suppliers = await q("select * from suppliers order by name");
    const products = await q("select * from products order by created_at desc");
    const variants = await q("select * from product_variants order by sku");
    const customers = await q("select * from customers order by created_at desc");
    const orders = await q("select * from orders order by created_at desc");
    const orderItems = await q("select * from order_items");
    const orderEvents = await q("select * from order_events order by created_at");
    const deliveries = await q("select * from deliveries order by created_at desc");
    const sales = await q("select * from sales order by created_at desc");
    const saleItems = await q("select * from sale_items");
    const movements = await q("select * from stock_movements order by created_at desc");
    const purchaseOrders = await q("select * from purchase_orders order by created_at desc");
    const poItems = await q("select * from purchase_items");
    const expenses = await q("select * from expenses order by created_at desc");
    const transactions = await q("select * from financial_transactions order by created_at desc");
    const cashSessions = await q("select * from cash_sessions order by opened_at desc");
    const notifications = await q("select * from notifications order by created_at desc");
    const auditLogs = await q("select * from audit_logs order by created_at desc");
    const communes = await q("select * from communes order by name");
    const zones = await q("select * from delivery_zones order by commune_id, name");

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

    return {
      company: companyRows[0] ? mapCompany(companyRows[0]) : EMPTY_APP_STATE.company,
      postes: postes.map(mapPoste),
      users: users.map((row) => mapUser(row, extraByUser.get(String(row.id)) ?? [])),
      drivers: drivers.map((row) => mapDriver(row, zonesByDriver.get(String(row.id)) ?? [])),
      categories: categories.map(mapCategory),
      brands: brands.map(mapBrand),
      suppliers: suppliers.map(mapSupplier),
      products: products.map((row) => {
        const list: ProductVariant[] = (variantsByProduct.get(String(row.id)) ?? []).map(mapVariant);
        return mapProduct(row, list);
      }),
      customers: customers.map(mapCustomer),
      orders: orders.map((row) =>
        mapOrder(
          row,
          (itemsByOrder.get(String(row.id)) ?? []).map(mapOrderItem),
          (eventsByOrder.get(String(row.id)) ?? []).map(mapOrderEvent),
        ),
      ),
      deliveries: deliveries.map(mapDelivery),
      sales: sales.map((row) => mapSale(row, (itemsBySale.get(String(row.id)) ?? []).map(mapSaleItem))),
      movements: movements.map(mapMovement),
      purchaseOrders: purchaseOrders.map((row) =>
        mapPurchaseOrder(row, (itemsByPo.get(String(row.id)) ?? []).map(mapPurchaseItem)),
      ),
      expenses: expenses.map(mapExpense),
      transactions: transactions.map(mapTransaction),
      cashSessions: cashSessions.map(mapCashSession),
      notifications: notifications.map(mapNotification),
      auditLogs: auditLogs.map(mapAudit),
      communes: communes.map(mapCommune),
      zones: zones.map(mapZone),
    };
  });
}
