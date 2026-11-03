-- Real-world map support: campus location and building outlines in WGS84 ([lng, lat], GeoJSON order).
alter table public.campuses
  add column geo jsonb check (
    geo is null or (
      jsonb_typeof(geo->'center') = 'array' and jsonb_array_length(geo->'center') = 2
      and (geo->'center'->>0)::numeric between -180 and 180
      and (geo->'center'->>1)::numeric between -90 and 90
      and (geo->>'zoom')::numeric between 1 and 22
    )
  );

alter table public.buildings
  add column geo jsonb check (
    geo is null or (
      jsonb_typeof(geo->'footprint') = 'array'
      and jsonb_array_length(geo->'footprint') between 3 and 500
    )
  );

comment on column public.campuses.geo is 'Real-map location {center:[lng,lat], zoom, bearing?, source?}. Written by staff with campus.manage.';
comment on column public.buildings.geo is 'Building outline on the real map {footprint:[[lng,lat],...]}. Written by staff with building.manage.';
