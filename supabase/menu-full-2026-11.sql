-- =====================================================================
--  FEBYS — full à-la-carte menu (from the Nov 2026 menu photos)
--  Adds: Pork (non-halal), Chicken, Beef, Fish & Seafood, Vegetables,
--        Pasta & Noodles, Kakanin, and fills the existing Dessert category.
--  Hides the old "Food Trays" placeholder category (price-on-request items
--  that are now on the menu with real prices). Nothing is deleted.
--  Holiday Combos / Party Packages / Specials are left as they are.
--
--  Safe to run more than once: categories match on slug, items match on
--  (category, name), so nothing is duplicated. After this, manage the menu
--  in admin.html → Menu.
--
--  Portions ("Half tray", "Big tray", "30 pcs" …) are stored as a single
--  "Sizes / options" entry, so they show on the card, in the cart and in
--  the WhatsApp order. Add a second option in admin (e.g. "Big tray") when
--  a dish comes in more sizes.
-- =====================================================================

begin;

-- ---------- categories ----------
insert into febys.categories (slug, name, note, sort) values
  ('pork',          'Pork (Non-Halal)', 'Contains pork',               4),
  ('chicken',       'Chicken',          'Fried, grilled & saucy',      5),
  ('beef',          'Beef',             'Hearty stews & stir-fries',   6),
  ('seafood',       'Fish & Seafood',   'From the grill & the pan',    7),
  ('vegetables',    'Vegetables',       'Lumpia & gulay',              8),
  ('pasta-noodles', 'Pasta & Noodles',  'Big trays for sharing',       9)
on conflict (slug) do nothing;

-- existing Dessert category (made in admin) — keep it, just place it
update febys.categories set sort = 10, note = coalesce(note, 'Sweet endings') where slug = 'dessert-mun7';

insert into febys.categories (slug, name, note, sort) values
  ('kakanin', 'Kakanin', 'Filipino rice cakes', 11)
on conflict (slug) do nothing;

-- old placeholder list → hidden
update febys.categories set active = false, sort = 99 where slug = 'trays';

-- ---------- items ----------
-- portion = null  → fixed price; otherwise one size option at that price
with src(slug, sort, name, price, portion, tone, photo) as (values
  -- PORK (NON-HALAL)
  ('pork', 1,  'Lechon Roll',                   75, '1 kilo',     'g4', 'media/Lechon%20Roll.jpg'),
  ('pork', 2,  'Lechon Kawali',                 65, null,         'g4', null),
  ('pork', 3,  'Crispy Pata',                   65, null,         'g4', 'media/Crispy%20Pata.jpg'),
  ('pork', 4,  'Sisig''s Best',                 80, null,         'g4', 'media/Sisig.jpg'),
  ('pork', 5,  'Shanghai',                      75, '30 pcs',     'g4', 'media/Shanghai.jpg'),
  ('pork', 6,  'Pork BBQ',                     120, '15 sticks',  'g4', null),
  ('pork', 7,  'Grilled Liempo',                75, 'Half tray',  'g4', null),
  ('pork', 8,  'Menudo',                        85, 'Half tray',  'g4', null),
  ('pork', 9,  'Sinantomas / Binutuhan',        95, 'Half tray',  'g4', null),
  ('pork', 10, 'Afritada',                      85, 'Half tray',  'g4', null),
  ('pork', 11, 'Kare-Kare with Lechon Kawali',  95, 'Half tray',  'g4', null),
  ('pork', 12, 'Igado',                         85, 'Half tray',  'g4', null),
  ('pork', 13, 'Asado',                         90, 'Half tray',  'g4', null),
  ('pork', 14, 'Pork Baby Back Ribs',           85, 'Half tray',  'g4', null),
  ('pork', 15, 'Dinuguan',                      80, 'Half tray',  'g4', null),
  ('pork', 16, 'Humba',                         80, 'Half tray',  'g4', null),
  ('pork', 17, 'Bicol Express',                 75, 'Half tray',  'g4', null),
  ('pork', 18, 'Binagoongan',                   75, 'Half tray',  'g4', null),
  ('pork', 19, 'Lechon Paksiw',                 95, 'Half tray',  'g4', null),
  -- CHICKEN
  ('chicken', 1, 'Feby''s Fried Chicken',       50, null,         'g2', 'media/Feby_FriedChicken.jpg'),
  ('chicken', 2, 'Whole Grilled Chicken',       50, null,         'g2', null),
  ('chicken', 3, 'Fried Chicken',               65, '9 pcs',      'g2', null),
  ('chicken', 4, 'Chicken BBQ',                130, '15 sticks',  'g2', null),
  ('chicken', 5, 'Mang Inasal',                 95, 'Half tray',  'g2', null),
  ('chicken', 6, 'Sweet and Sour Chicken',      80, 'Half tray',  'g2', null),
  ('chicken', 7, 'Chicken Cordon Bleu',         90, 'Half tray',  'g2', null),
  ('chicken', 8, 'Buffalo Wings',               75, 'Half tray',  'g2', null),
  ('chicken', 9, 'Chicken Dynamite',            80, 'Half tray',  'g2', null),
  -- BEEF
  ('beef', 1,  'Beef Baby Back Ribs',          100, 'Half tray',  'g3', null),
  ('beef', 2,  'Caldereta',                     95, 'Half tray',  'g3', null),
  ('beef', 3,  'Beef Kare-Kare',                95, 'Half tray',  'g3', 'media/HalfTray_Karekare.jpg'),
  ('beef', 4,  'Beef Stir Fry',                 90, 'Half tray',  'g3', null),
  ('beef', 5,  'Roast Beef',                    90, 'Half tray',  'g3', null),
  ('beef', 6,  'Sizzling Bulalo',               90, 'Half tray',  'g3', null),
  ('beef', 7,  'Bulalo',                        85, 'Half tray',  'g3', null),
  ('beef', 8,  'Bopis',                         85, 'Half tray',  'g3', null),
  ('beef', 9,  'Creamy Beef & Mushroom',        90, 'Half tray',  'g3', null),
  ('beef', 10, 'Creamy Lengua',                100, 'Half tray',  'g3', null),
  ('beef', 11, 'Pepper Beef',                   90, 'Half tray',  'g3', null),
  ('beef', 12, 'Mongolian Beef',                90, 'Half tray',  'g3', null),
  -- FISH & SEAFOOD
  ('seafood', 1, 'Grilled Stuffed Tilapia',     35, 'Large size', 'g1', null),
  ('seafood', 2, 'Grilled Stuffed Bangus',      45, 'Large size', 'g1', null),
  ('seafood', 3, 'Relyenong Bangus',            75, 'Large size', 'g1', null),
  ('seafood', 4, 'Sweet & Sour Lapu-Lapu',      80, 'Half tray',  'g1', null),
  ('seafood', 5, 'Sweet & Sour Fish Fillet',    75, 'Half tray',  'g1', null),
  ('seafood', 6, 'Fried Tilapia',               35, 'Large size', 'g1', null),
  ('seafood', 7, 'Seafood Kare-Kare',           95, 'Half tray',  'g1', null),
  ('seafood', 8, 'Calamari',                    90, 'Half tray',  'g1', null),
  ('seafood', 9, 'Mixed Seafood Cajun',        100, 'Half tray',  'g1', null),
  -- VEGETABLES
  ('vegetables', 1, 'Fried Lumpiang Gulay',     75, '18 pcs',     'g1', null),
  ('vegetables', 2, 'Fresh Lumpia',             75, 'Half tray',  'g1', null),
  ('vegetables', 3, 'Vietnamese Spring Rolls',  90, 'Half tray',  'g1', null),
  ('vegetables', 4, 'Chopsuey',                 75, 'Half tray',  'g1', null),
  ('vegetables', 5, 'Pinakbet',                 70, 'Half tray',  'g1', null),
  ('vegetables', 6, 'Adobong Sitaw',            35, 'Half tray',  'g1', null),
  ('vegetables', 7, 'Ginataang Langka',         70, 'Half tray',  'g1', null),
  ('vegetables', 8, 'Ginataang Laing',          70, 'Half tray',  'g1', null),
  ('vegetables', 9, 'Gising-Gising',            70, 'Half tray',  'g1', null),
  -- PASTA & NOODLES
  ('pasta-noodles', 1,  'Bolognese',            180, 'Big tray',  'g2', 'media/spaghetti.jpg'),
  ('pasta-noodles', 2,  'Baked Mac',            190, 'Big tray',  'g2', null),
  ('pasta-noodles', 3,  'Lasagna',              200, 'Big tray',  'g2', 'media/lasagna.jpg'),
  ('pasta-noodles', 4,  'Carbonara',            180, 'Big tray',  'g2', null),
  ('pasta-noodles', 5,  'Chicken Alfredo',      170, 'Big tray',  'g2', null),
  ('pasta-noodles', 6,  'Seafood Pasta',        180, 'Big tray',  'g2', null),
  ('pasta-noodles', 7,  'Chicken Macaroni Salad',170,'Big tray',  'g2', null),
  ('pasta-noodles', 8,  'Japchae',              180, 'Big tray',  'g2', null),
  ('pasta-noodles', 10, 'Pansit Malabon',       180, 'Big tray',  'g2', null),
  -- DESSERT (existing category)
  ('dessert-mun7', 1, 'Leche Flan',             22, 'Per llanera','g3', null),
  ('dessert-mun7', 2, 'Oreo Graham',            75, 'Half tray',  'g3', null),
  ('dessert-mun7', 3, 'Mango Graham',          100, 'Half tray',  'g3', null),
  ('dessert-mun7', 4, 'Tiramisu',              120, 'Half tray',  'g3', null),
  ('dessert-mun7', 5, 'Buko Salad',             90, 'Half tray',  'g3', null),
  ('dessert-mun7', 6, 'Buko Pandan',            75, 'Half tray',  'g3', null),
  -- KAKANIN
  ('kakanin', 1, 'Pichi-Pichi',                 70, '30 pcs',     'g4', null),
  ('kakanin', 2, 'Kutsinta',                    70, '30 pcs',     'g4', null),
  ('kakanin', 3, 'Puto Cheese',                 70, '30 pcs',     'g4', null),
  ('kakanin', 4, 'Puto Cheese with Salted Egg', 90, '30 pcs',     'g4', null),
  ('kakanin', 5, 'Puto Pao',                    90, '30 pcs',     'g4', null),
  ('kakanin', 6, 'Cassava Cake',                80, 'Half tray',  'g4', null),
  ('kakanin', 7, 'Sapin-Sapin',                 80, 'Round tray', 'g4', null),
  ('kakanin', 8, 'Biko',                       100, 'Round tray', 'g4', null),
  ('kakanin', 9, 'Cheezy Nilupak',             100, 'Half tray',  'g4', null)
)
insert into febys.menu_items (category_id, name, price, variants, tone, photo_url, sort)
select c.id, s.name,
       case when s.portion is null then s.price end,
       case when s.portion is null then '[]'::jsonb
            else jsonb_build_array(jsonb_build_object('label', s.portion, 'price', s.price)) end,
       s.tone, s.photo, s.sort
from src s
join febys.categories c on c.slug = s.slug
where not exists (select 1 from febys.menu_items m where m.category_id = c.id and lower(m.name) = lower(s.name));

-- Pansit Bihon / Canton: one dish, choose the noodle
insert into febys.menu_items (category_id, name, price, variants, tone, sort)
select c.id, 'Pansit Bihon / Canton', null,
       '[{"label":"Bihon · Big tray","price":150},{"label":"Canton · Big tray","price":150}]'::jsonb, 'g2', 9
from febys.categories c
where c.slug = 'pasta-noodles'
  and not exists (select 1 from febys.menu_items m where m.category_id = c.id and m.name = 'Pansit Bihon / Canton');

commit;

-- check
select c.sort, c.name, c.active, count(i.id) as items, count(i.id) filter (where i.active) as showing
from febys.categories c left join febys.menu_items i on i.category_id = c.id
group by c.id order by c.sort;
