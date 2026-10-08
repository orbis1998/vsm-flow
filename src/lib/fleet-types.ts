export type FleetTrailPoint = { lng: number; lat: number; at: string };
export type FleetDriverLive = {
  id: string;
  fullName: string;
  phone: string;
  vehicle: string;
  lastLat?: number;
  lastLng?: number;
  lastHeading?: number;
  lastSeenAt?: string;
  trail: FleetTrailPoint[];
};
export type FleetOrderLive = {
  id: string;
  reference: string;
  customerName: string;
  communeId: string;
  zoneId: string;
  addressDetail: string;
  status: string;
  driverId?: string;
  dueAt?: string;
};
export type FleetLive = {
  drivers: FleetDriverLive[];
  orders: FleetOrderLive[];
};
