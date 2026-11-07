-- Toilets and prayer rooms are usually separate for men and women.
-- gender: 'male' | 'female' | 'all' (shared); only meaningful for those two room types.
alter table public.rooms add column gender text
  check (gender is null or gender in ('male', 'female', 'all'));
alter table public.rooms add constraint rooms_gender_type_check
  check (gender is null or type in ('toilet', 'prayer_room'));
comment on column public.rooms.gender is 'Who may use a toilet or prayer room: male, female or all. Null = not set.';
