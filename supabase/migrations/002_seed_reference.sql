-- Référentiels Business Suite (Kinshasa)

insert into company_settings (id, name, legal_name, phone, email, address, currency, default_delivery_fee, low_stock_alert)
values (
  'company',
  'Business Suite',
  '',
  '',
  '',
  '',
  'USD',
  0,
  true
)
on conflict (id) do update set
  name = excluded.name,
  legal_name = excluded.legal_name,
  phone = excluded.phone,
  email = excluded.email,
  address = excluded.address,
  currency = excluded.currency,
  default_delivery_fee = excluded.default_delivery_fee,
  low_stock_alert = excluded.low_stock_alert,
  updated_at = now();

insert into roles (code, label, description, enabled) values
  ('ADMIN', 'Administrateur', 'Accès total à toutes les sections et à la configuration.', true),
  ('GERANT', 'Gérant', 'Gestion opérationnelle : commandes, stock, POS, clients, logistique.', true),
  ('LIVREUR', 'Livreur', 'Commandes assignées, livraison, scan et vente au poste si autorisé.', true),
  ('CAISSIER', 'Caissier', 'Ventes au comptoir et clôture de caisse.', true),
  ('MAGASINIER', 'Magasinier', 'Stock, entrées/sorties et inventaires.', true),
  ('COMPTABLE', 'Comptable', 'Finance, dépenses, rapports.', true),
  ('RESP_LOGISTIQUE', 'Responsable logistique', 'Suivi et assignation des livraisons.', true)
on conflict (code) do update set label = excluded.label, description = excluded.description, enabled = excluded.enabled;

delete from role_permissions;

insert into role_permissions (role_code, permission)
select 'ADMIN', p from unnest(array[
  'dashboard.view','orders.view','orders.manage','orders.assigned.view',
  'products.view','products.manage','stock.view','stock.manage','pos.use',
  'logistics.view','logistics.manage','customers.view','customers.manage',
  'suppliers.view','suppliers.manage','finance.view','finance.manage',
  'reports.view','users.view','users.manage','settings.view','settings.manage','driver.space'
]) as p;

insert into role_permissions (role_code, permission)
select 'GERANT', p from unnest(array[
  'dashboard.view','orders.view','orders.manage','products.view','products.manage',
  'stock.view','stock.manage','pos.use','logistics.view','logistics.manage',
  'customers.view','customers.manage','suppliers.view','suppliers.manage',
  'finance.view','reports.view','users.view','settings.view','settings.manage'
]) as p;

insert into role_permissions (role_code, permission)
select 'LIVREUR', p from unnest(array['orders.assigned.view','driver.space','pos.use']) as p;

insert into role_permissions (role_code, permission)
select 'CAISSIER', p from unnest(array['pos.use','customers.view','dashboard.view']) as p;

insert into role_permissions (role_code, permission)
select 'MAGASINIER', p from unnest(array['stock.view','stock.manage','products.view','dashboard.view']) as p;

insert into role_permissions (role_code, permission)
select 'COMPTABLE', p from unnest(array['finance.view','finance.manage','reports.view','dashboard.view']) as p;

insert into role_permissions (role_code, permission)
select 'RESP_LOGISTIQUE', p from unnest(array['logistics.view','logistics.manage','orders.view','dashboard.view']) as p;

insert into communes (id, name) values
  ('com-01', 'Gombe'),
  ('com-02', 'Kinshasa'),
  ('com-03', 'Barumbu'),
  ('com-04', 'Lingwala'),
  ('com-05', 'Kintambo'),
  ('com-06', 'Kasa-Vubu'),
  ('com-07', 'Kalamu'),
  ('com-08', 'Ngiri-Ngiri'),
  ('com-09', 'Bandalungwa'),
  ('com-10', 'Selembao'),
  ('com-11', 'Bumbu'),
  ('com-12', 'Makala'),
  ('com-13', 'Ngaba'),
  ('com-14', 'Lemba'),
  ('com-15', 'Matete'),
  ('com-16', 'Limete'),
  ('com-17', 'Kisenso'),
  ('com-18', 'Ndjili'),
  ('com-19', 'Masina'),
  ('com-20', 'Kimbanseke'),
  ('com-21', 'Ngaliema'),
  ('com-22', 'Mont-Ngafula'),
  ('com-23', 'Nsele'),
  ('com-24', 'Maluku')
on conflict (id) do update set name = excluded.name;

insert into delivery_zones (id, commune_id, name, default_fee) values
  ('zon-01-1', 'com-01', 'Centre-ville', 3),
  ('zon-01-2', 'com-01', 'Ma Campagne', 3),
  ('zon-01-3', 'com-01', 'Beach Ngobila', 3),
  ('zon-01-4', 'com-01', 'Place Royale', 3),
  ('zon-02-1', 'com-02', 'Kato', 3),
  ('zon-02-2', 'com-02', 'Pétrole', 3),
  ('zon-02-3', 'com-02', 'Madimba', 3),
  ('zon-02-4', 'com-02', 'Boyata', 3),
  ('zon-03-1', 'com-03', 'Bon Marché', 3),
  ('zon-03-2', 'com-03', 'Funa', 3),
  ('zon-03-3', 'com-03', 'Mozindo', 3),
  ('zon-03-4', 'com-03', 'Kasa-Vubu', 3),
  ('zon-04-1', 'com-04', 'Croix-Rouge', 3),
  ('zon-04-2', 'com-04', 'Boyambi', 3),
  ('zon-04-3', 'com-04', 'Singa Mopepe', 3),
  ('zon-05-1', 'com-05', 'Magasin', 3.5),
  ('zon-05-2', 'com-05', 'Jamaïque', 3.5),
  ('zon-05-3', 'com-05', 'Lonzo', 3.5),
  ('zon-05-4', 'com-05', 'Kilimani', 3.5),
  ('zon-06-1', 'com-06', 'Katanga', 3.5),
  ('zon-06-2', 'com-06', 'Assossa', 3.5),
  ('zon-06-3', 'com-06', 'Mbuji-Mayi', 3.5),
  ('zon-07-1', 'com-07', 'Yolo Sud', 3.5),
  ('zon-07-2', 'com-07', 'Yolo Nord', 3.5),
  ('zon-07-3', 'com-07', 'Matonge', 3.5),
  ('zon-07-4', 'com-07', 'Kauka', 3.5),
  ('zon-08-1', 'com-08', 'Bikuku', 3.5),
  ('zon-08-2', 'com-08', 'Saïo', 3.5),
  ('zon-08-3', 'com-08', 'Ngiri centre', 3.5),
  ('zon-09-1', 'com-09', 'Adoula', 4),
  ('zon-09-2', 'com-09', 'Lubudi', 4),
  ('zon-09-3', 'com-09', 'Makelele', 4),
  ('zon-09-4', 'com-09', 'Mbinza', 4),
  ('zon-10-1', 'com-10', 'Cité Verte', 4.5),
  ('zon-10-2', 'com-10', 'Herady', 4.5),
  ('zon-10-3', 'com-10', 'Ngafani', 4.5),
  ('zon-10-4', 'com-10', 'Molende', 4.5),
  ('zon-11-1', 'com-11', 'Mbala', 4.5),
  ('zon-11-2', 'com-11', 'Mfinda', 4.5),
  ('zon-11-3', 'com-11', 'Ngafula', 4.5),
  ('zon-12-1', 'com-12', 'Kimbondo', 4.5),
  ('zon-12-2', 'com-12', 'Kitega', 4.5),
  ('zon-12-3', 'com-12', 'Lubudi', 4.5),
  ('zon-13-1', 'com-13', 'Luyi', 4),
  ('zon-13-2', 'com-13', 'Baobab', 4),
  ('zon-13-3', 'com-13', 'Bikanga', 4),
  ('zon-14-1', 'com-14', 'Salongo', 4),
  ('zon-14-2', 'com-14', 'Righini', 4),
  ('zon-14-3', 'com-14', 'Campus', 4),
  ('zon-14-4', 'com-14', 'Gombele', 4),
  ('zon-15-1', 'com-15', 'Tomba', 4.5),
  ('zon-15-2', 'com-15', 'Tshisekedi', 4.5),
  ('zon-15-3', 'com-15', 'Vijana', 4.5),
  ('zon-15-4', 'com-15', 'Sans-Fil', 4.5),
  ('zon-16-1', 'com-16', 'Industriel', 4),
  ('zon-16-2', 'com-16', 'Résidentiel', 4),
  ('zon-16-3', 'com-16', 'Kingabwa', 4),
  ('zon-16-4', 'com-16', '7ème rue', 4),
  ('zon-17-1', 'com-17', 'Mission', 5),
  ('zon-17-2', 'com-17', 'Regideso', 5),
  ('zon-17-3', 'com-17', 'Kumbu', 5),
  ('zon-17-4', 'com-17', 'Ngomba', 5),
  ('zon-18-1', 'com-18', 'Quartier 1', 5),
  ('zon-18-2', 'com-18', 'Quartier 7', 5),
  ('zon-18-3', 'com-18', 'Sainte-Thérèse', 5),
  ('zon-18-4', 'com-18', 'Kimbwala', 5),
  ('zon-19-1', 'com-19', 'Petro-Congo', 5.5),
  ('zon-19-2', 'com-19', 'Sans-Fil', 5.5),
  ('zon-19-3', 'com-19', 'Abattoir', 5.5),
  ('zon-19-4', 'com-19', 'Quartier 4', 5.5),
  ('zon-20-1', 'com-20', 'Mikonga', 6),
  ('zon-20-2', 'com-20', 'Kingasani', 6),
  ('zon-20-3', 'com-20', 'Bahumbu', 6),
  ('zon-20-4', 'com-20', 'Mateba', 6),
  ('zon-21-1', 'com-21', 'Binza Delvaux', 5),
  ('zon-21-2', 'com-21', 'Binza Pigeon', 5),
  ('zon-21-3', 'com-21', 'Kinsuka', 5),
  ('zon-21-4', 'com-21', 'Basoko', 5),
  ('zon-22-1', 'com-22', 'Kimwenza', 6.5),
  ('zon-22-2', 'com-22', 'Ngansele', 6.5),
  ('zon-22-3', 'com-22', 'Mitendi', 6.5),
  ('zon-22-4', 'com-22', 'Cité Maman Mobutu', 6.5),
  ('zon-23-1', 'com-23', 'Menkao', 8),
  ('zon-23-2', 'com-23', 'Bibwa', 8),
  ('zon-23-3', 'com-23', 'Mikonga 2', 8),
  ('zon-23-4', 'com-23', 'Dingi-Dingi', 8),
  ('zon-24-1', 'com-24', 'Kinkole', 10),
  ('zon-24-2', 'com-24', 'Mbankana', 10),
  ('zon-24-3', 'com-24', 'Dumi', 10)
on conflict (id) do update set
  commune_id = excluded.commune_id,
  name = excluded.name,
  default_fee = excluded.default_fee;
