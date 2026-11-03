-- Real-world walkway paths: an outdoor navigation edge may carry the line it
-- follows on the ground ([lng, lat] points, GeoJSON order, from-node to
-- to-node), drawn by staff or imported from OpenStreetMap. The router measures
-- the edge along this line when distance_m is not given.
alter table public.navigation_edges
  add column geometry jsonb check (
    geometry is null or (
      jsonb_typeof(geometry) = 'array'
      and jsonb_array_length(geometry) between 2 and 2000
      and kind = 'outdoor'
    )
  );

comment on column public.navigation_edges.geometry is 'Outdoor walkway path on the real map [[lng,lat],...]. Only allowed on outdoor edges. Written by staff with map.edit.';
