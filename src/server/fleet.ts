import { withClient } from "./db";
import type { FleetDriverLive, FleetLive, FleetOrderLive, FleetTrailPoint } from "@/lib/fleet-types";

export type { FleetDriverLive, FleetLive, FleetOrderLive, FleetTrailPoint };

type DriverRow = {
  id: unknown;
  full_name: unknown;
  phone: unknown;
  vehicle: unknown;
  last_lat: unknown;
  last_lng: unknown;
  last_heading: unknown;
  last_seen_at: unknown;
};
type OrderRow = {
  id: unknown;
  reference: unknown;
  customer_name: unknown;
  commune_id: unknown;
  zone_id: unknown;
  address_detail: unknown;
  status: unknown;
  driver_id: unknown;
  due_at: unknown;
};
type TrailRow = {
  driver_id: unknown;
  lng: unknown;
  lat: unknown;
  recorded_at: Date | string;
};

export async function loadFleetLive(): Promise<FleetLive> {
  return withClient(async (client) => {
    try {
      const { ensureDriverTrail } = await import("./db");
      await ensureDriverTrail(client);
    } catch {
      // ignore
    }
    const drivers = await client.query(
      `select id, full_name, phone, vehicle, last_lat, last_lng, last_heading, last_seen_at
       from delivery_drivers
       where active = true
       order by full_name`,
    );
    const orders = await client.query(
      `select id, reference, customer_name, commune_id, zone_id, address_detail, status, driver_id, due_at
       from orders
       where status in ('assignee', 'en_livraison')
       order by created_at desc`,
    );
    const trails = await client.query(
      `select driver_id, lng, lat, recorded_at
       from driver_positions
       where recorded_at > now() - interval '3 hours'
       order by recorded_at asc`,
    );
    const byDriver = new Map<string, FleetTrailPoint[]>();
    for (const row of trails.rows as TrailRow[]) {
      const id = String(row.driver_id);
      const list = byDriver.get(id) ?? [];
      list.push({
        lng: Number(row.lng),
        lat: Number(row.lat),
        at: new Date(row.recorded_at).toISOString(),
      });
      byDriver.set(id, list);
    }
    return {
      drivers: (drivers.rows as DriverRow[]).map((row) => {
        const item: FleetDriverLive = {
          id: String(row.id),
          fullName: String(row.full_name),
          phone: String(row.phone ?? ""),
          vehicle: String(row.vehicle ?? ""),
          trail: byDriver.get(String(row.id)) ?? [],
        };
        if (row.last_lat != null) item.lastLat = Number(row.last_lat);
        if (row.last_lng != null) item.lastLng = Number(row.last_lng);
        if (row.last_heading != null) item.lastHeading = Number(row.last_heading);
        if (row.last_seen_at) item.lastSeenAt = new Date(String(row.last_seen_at)).toISOString();
        return item;
      }),
      orders: (orders.rows as OrderRow[]).map((row) => {
        const item: FleetOrderLive = {
          id: String(row.id),
          reference: String(row.reference),
          customerName: String(row.customer_name ?? "Client"),
          communeId: String(row.commune_id ?? ""),
          zoneId: String(row.zone_id ?? ""),
          addressDetail: String(row.address_detail ?? ""),
          status: String(row.status),
        };
        if (row.driver_id) item.driverId = String(row.driver_id);
        if (row.due_at) item.dueAt = new Date(String(row.due_at)).toISOString();
        return item;
      }),
    };
  });
}
