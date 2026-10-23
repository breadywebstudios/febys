begin;

alter table febys.gallery
  add column if not exists category text not null default 'food';

alter table febys.gallery
  drop constraint if exists gallery_category_check;

alter table febys.gallery
  add constraint gallery_category_check
  check (category in ('food', 'events', 'catering'));

update febys.gallery
set category = case
  when lower(coalesce(caption, '') || ' ' || path) ~ '\m(event|wedding|birthday|celebration|party|function|grazing)\M' then 'events'
  when lower(coalesce(caption, '') || ' ' || path) ~ '\m(catering|buffet|chafing|tray|combo|package|corporate)\M' then 'catering'
  else 'food'
end;

commit;
