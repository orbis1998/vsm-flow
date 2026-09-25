import type { Commune, DeliveryZone } from "@/types";

// Les 24 communes de Kinshasa, avec des zones/quartiers réalistes.
const RAW: Array<[string, string[], number]> = [
  ["Gombe", ["Centre-ville", "Ma Campagne", "Beach Ngobila", "Place Royale"], 3],
  ["Kinshasa", ["Kato", "Pétrole", "Madimba", "Boyata"], 3],
  ["Barumbu", ["Bon Marché", "Funa", "Mozindo", "Kasa-Vubu"], 3],
  ["Lingwala", ["Croix-Rouge", "Boyambi", "Singa Mopepe"], 3],
  ["Kintambo", ["Magasin", "Jamaïque", "Lonzo", "Kilimani"], 3.5],
  ["Kasa-Vubu", ["Katanga", "Assossa", "Mbuji-Mayi"], 3.5],
  ["Kalamu", ["Yolo Sud", "Yolo Nord", "Matonge", "Kauka"], 3.5],
  ["Ngiri-Ngiri", ["Bikuku", "Saïo", "Ngiri centre"], 3.5],
  ["Bandalungwa", ["Adoula", "Lubudi", "Makelele", "Mbinza"], 4],
  ["Selembao", ["Cité Verte", "Herady", "Ngafani", "Molende"], 4.5],
  ["Bumbu", ["Mbala", "Mfinda", "Ngafula"], 4.5],
  ["Makala", ["Kimbondo", "Kitega", "Lubudi"], 4.5],
  ["Ngaba", ["Luyi", "Baobab", "Bikanga"], 4],
  ["Lemba", ["Salongo", "Righini", "Campus", "Gombele"], 4],
  ["Matete", ["Tomba", "Tshisekedi", "Vijana", "Sans-Fil"], 4.5],
  ["Limete", ["Industriel", "Résidentiel", "Kingabwa", "7ème rue"], 4],
  ["Kisenso", ["Mission", "Regideso", "Kumbu", "Ngomba"], 5],
  ["Ndjili", ["Quartier 1", "Quartier 7", "Sainte-Thérèse", "Kimbwala"], 5],
  ["Masina", ["Petro-Congo", "Sans-Fil", "Abattoir", "Quartier 4"], 5.5],
  ["Kimbanseke", ["Mikonga", "Kingasani", "Bahumbu", "Mateba"], 6],
  ["Ngaliema", ["Binza Delvaux", "Binza Pigeon", "Kinsuka", "Basoko"], 5],
  ["Mont-Ngafula", ["Kimwenza", "Ngansele", "Mitendi", "Cité Maman Mobutu"], 6.5],
  ["Nsele", ["Menkao", "Bibwa", "Mikonga 2", "Dingi-Dingi"], 8],
  ["Maluku", ["Kinkole", "Mbankana", "Dumi"], 10],
];

export const COMMUNES: Commune[] = RAW.map(([name], i) => ({
  id: `com-${String(i + 1).padStart(2, "0")}`,
  name,
}));

export const ZONES: DeliveryZone[] = RAW.flatMap(([, zones, fee], i) =>
  zones.map((zone, j) => ({
    id: `zon-${String(i + 1).padStart(2, "0")}-${j + 1}`,
    communeId: `com-${String(i + 1).padStart(2, "0")}`,
    name: zone,
    defaultFee: fee,
  })),
);

export function communeName(id: string): string {
  return COMMUNES.find((c) => c.id === id)?.name ?? "—";
}

export function zoneName(id: string): string {
  return ZONES.find((z) => z.id === id)?.name ?? "—";
}

export function zonesOfCommune(communeId: string): DeliveryZone[] {
  return ZONES.filter((z) => z.communeId === communeId);
}
