begin;

delete from febys.gallery old
where old.path ~ '^(Combo1|Combo2|Combo3)/'
  and exists (
    select 1 from febys.gallery current
    where current.path = 'media/' || split_part(old.path, '/', 2)
  );

update febys.gallery
set path = 'media/' || split_part(path, '/', 2)
where path ~ '^(Combo1|Combo2|Combo3)/';

update febys.reviews
set photo_url = 'media/' || split_part(photo_url, '/', 2)
where photo_url ~ '^(Combo1|Combo2|Combo3)/';

commit;
