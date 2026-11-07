-- SUE · Year 1 (UG1), section C/C — timetable as provided by a student (2026-11-07).
-- Status: UNVERIFIED, university unpublished. Assumptions to confirm:
--   * department = Electrical Engineering (sections E/C, P/R, C/C look like its branches)
--   * rooms E1xx on floor 1, E2xx on floor 2 of one College of Engineering building
--   * teaching period = whole academic year 2026-2027 until real semester dates are known
--   * floor plan sizes are placeholders (no plan drawn yet)
-- Idempotent: safe to run again.
do $$
declare
  u uuid; dept uuid; camp uuid; bld uuid; f1 uuid; f2 uuid; sem uuid; grp uuid;
  r109 uuid; r205 uuid; r229 uuid;
  l_soma uuid; l_khasraw uuid; l_barzan uuid; l_nian uuid; l_roshna uuid; l_rebaz uuid; l_lina uuid; l_goran uuid;
  c_eng uuid; c_ec uuid; c_ecl uuid; c_cs uuid; c_csl uuid; c_kurd uuid; c_math uuid; c_algo uuid;
begin
  select id into u from public.universities where slug = 'sue';
  if u is null then raise exception 'SUE university not found'; end if;
  select id into dept from public.departments where university_id = u and name->>'en' = 'Electrical Engineering' and college->>'en' = 'College of Engineering';
  if dept is null then raise exception 'Electrical Engineering department not found'; end if;

  -- Campus / building / floors / rooms
  select id into camp from public.campuses where university_id = u and name->>'en' = 'Main campus';
  if camp is null then insert into public.campuses (university_id, name, geo) values (u, '{"en":"Main campus"}', '{"center":[44.0249844,36.1439009],"zoom":16.5,"bearing":0,"source":"OpenStreetMap — SUE main campus (College of Law Street). Confirm with the university."}') returning id into camp; end if;
  select id into bld from public.buildings where university_id = u and code = 'ENG';
  if bld is null then
    insert into public.buildings (university_id, campus_id, code, name, data_status) values (u, camp, 'ENG', '{"en":"College of Engineering"}', 'unverified') returning id into bld;
  end if;
  update public.departments set building_id = bld where id = dept and building_id is null;
  select id into f1 from public.floors where building_id = bld and level = 1;
  if f1 is null then insert into public.floors (university_id, building_id, level, name, width, height, meters_per_unit) values (u, bld, 1, '{"en":"Floor 1"}', 1000, 600, 0.05) returning id into f1; end if;
  select id into f2 from public.floors where building_id = bld and level = 2;
  if f2 is null then insert into public.floors (university_id, building_id, level, name, width, height, meters_per_unit) values (u, bld, 2, '{"en":"Floor 2"}', 1000, 600, 0.05) returning id into f2; end if;

  select id into r109 from public.rooms where building_id = bld and code = 'E109' and deleted_at is null;
  if r109 is null then insert into public.rooms (university_id, building_id, floor_id, code, name, type, department_id, data_status) values (u, bld, f1, 'E109', '{"en":"Electrical Circuits Lab E109"}', 'laboratory', dept, 'unverified') returning id into r109; end if;
  select id into r205 from public.rooms where building_id = bld and code = 'E205' and deleted_at is null;
  if r205 is null then insert into public.rooms (university_id, building_id, floor_id, code, name, type, department_id, data_status) values (u, bld, f2, 'E205', '{"en":"Computer Lab E205"}', 'laboratory', dept, 'unverified') returning id into r205; end if;
  select id into r229 from public.rooms where building_id = bld and code = 'E229' and deleted_at is null;
  if r229 is null then insert into public.rooms (university_id, building_id, floor_id, code, name, type, department_id, data_status) values (u, bld, f2, 'E229', '{"en":"Hall E229"}', 'classroom', dept, 'unverified') returning id into r229; end if;

  -- Lecturers (names as on the timetable)
  select id into l_soma from public.lecturers where university_id = u and full_name->>'en' = 'Ms. Soma';
  if l_soma is null then insert into public.lecturers (university_id, department_id, full_name, data_status) values (u, dept, '{"en":"Ms. Soma"}', 'unverified') returning id into l_soma; end if;
  select id into l_khasraw from public.lecturers where university_id = u and full_name->>'en' = 'Mr. Khasraw';
  if l_khasraw is null then insert into public.lecturers (university_id, department_id, full_name, data_status) values (u, dept, '{"en":"Mr. Khasraw"}', 'unverified') returning id into l_khasraw; end if;
  select id into l_barzan from public.lecturers where university_id = u and full_name->>'en' = 'Mr. Barzan';
  if l_barzan is null then insert into public.lecturers (university_id, department_id, full_name, data_status) values (u, dept, '{"en":"Mr. Barzan"}', 'unverified') returning id into l_barzan; end if;
  select id into l_nian from public.lecturers where university_id = u and full_name->>'en' = 'Mrs. Nian';
  if l_nian is null then insert into public.lecturers (university_id, department_id, full_name, data_status) values (u, dept, '{"en":"Mrs. Nian"}', 'unverified') returning id into l_nian; end if;
  select id into l_roshna from public.lecturers where university_id = u and full_name->>'en' = 'Mrs. Roshna';
  if l_roshna is null then insert into public.lecturers (university_id, department_id, full_name, data_status) values (u, dept, '{"en":"Mrs. Roshna"}', 'unverified') returning id into l_roshna; end if;
  select id into l_rebaz from public.lecturers where university_id = u and full_name->>'en' = 'Mr. Rebaz';
  if l_rebaz is null then insert into public.lecturers (university_id, department_id, full_name, data_status) values (u, dept, '{"en":"Mr. Rebaz"}', 'unverified') returning id into l_rebaz; end if;
  select id into l_lina from public.lecturers where university_id = u and full_name->>'en' = 'Mrs. Lina';
  if l_lina is null then insert into public.lecturers (university_id, department_id, full_name, data_status) values (u, dept, '{"en":"Mrs. Lina"}', 'unverified') returning id into l_lina; end if;
  select id into l_goran from public.lecturers where university_id = u and full_name->>'en' = 'Mr. Goran';
  if l_goran is null then insert into public.lecturers (university_id, department_id, full_name, data_status) values (u, dept, '{"en":"Mr. Goran"}', 'unverified') returning id into l_goran; end if;

  -- Courses
  insert into public.courses (university_id, department_id, code, name) values
    (u, dept, 'EE1-ENG', '{"en":"English for University Students"}'),
    (u, dept, 'EE1-EC', '{"en":"Electrical Circuits I"}'),
    (u, dept, 'EE1-EC-LAB', '{"en":"Electrical Circuits I (Lab)"}'),
    (u, dept, 'EE1-CS', '{"en":"Computer Skills"}'),
    (u, dept, 'EE1-CS-LAB', '{"en":"Computer Skills (Lab)"}'),
    (u, dept, 'EE1-KURD', '{"en":"Kurdish Studies"}'),
    (u, dept, 'EE1-MATH', '{"en":"Mathematics I"}'),
    (u, dept, 'EE1-ALGO', '{"en":"Algorithm and Problem Solving"}')
  on conflict do nothing;
  select id into c_eng from public.courses where university_id = u and code = 'EE1-ENG' and deleted_at is null;
  select id into c_ec from public.courses where university_id = u and code = 'EE1-EC' and deleted_at is null;
  select id into c_ecl from public.courses where university_id = u and code = 'EE1-EC-LAB' and deleted_at is null;
  select id into c_cs from public.courses where university_id = u and code = 'EE1-CS' and deleted_at is null;
  select id into c_csl from public.courses where university_id = u and code = 'EE1-CS-LAB' and deleted_at is null;
  select id into c_kurd from public.courses where university_id = u and code = 'EE1-KURD' and deleted_at is null;
  select id into c_math from public.courses where university_id = u and code = 'EE1-MATH' and deleted_at is null;
  select id into c_algo from public.courses where university_id = u and code = 'EE1-ALGO' and deleted_at is null;

  -- Semester and group
  select id into sem from public.semesters where university_id = u and academic_year = '2026-2027';
  if sem is null then insert into public.semesters (university_id, academic_year, name, start_date, end_date) values (u, '2026-2027', '{"en":"Academic year 2026–2027 (dates to confirm)"}', '2026-09-01', '2027-06-30') returning id into sem; end if;
  select id into grp from public.student_groups where university_id = u and code = 'EE-UG1-CC' and academic_year = '2026-2027' and deleted_at is null;
  if grp is null then insert into public.student_groups (university_id, department_id, code, name, academic_year, stage) values (u, dept, 'EE-UG1-CC', '{"en":"Year 1 — Section C/C"}', '2026-2027', 1) returning id into grp; end if;

  -- Replace this group's weekly entries (Sunday = 0)
  delete from public.timetable_entries where group_id = grp;
  insert into public.timetable_entries (university_id, semester_id, course_id, lecturer_id, room_id, group_id, kind, recurrence, day, start_time, end_time, valid_from, valid_to) values
    (u, sem, c_eng,  l_soma,    r229, grp, 'lecture', 'weekly', 0, '11:00', '13:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_ecl,  l_khasraw, r109, grp, 'lab',     'weekly', 1, '09:00', '11:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_cs,   l_nian,    r229, grp, 'lecture', 'weekly', 1, '11:00', '12:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_ec,   l_khasraw, r229, grp, 'lecture', 'weekly', 1, '13:00', '15:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_kurd, l_rebaz,   r229, grp, 'lecture', 'weekly', 2, '09:00', '11:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_math, l_lina,    r229, grp, 'lecture', 'weekly', 2, '11:00', '13:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_math, l_lina,    r229, grp, 'lecture', 'weekly', 3, '09:00', '11:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_algo, l_goran,   r229, grp, 'lecture', 'weekly', 3, '11:00', '13:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_ec,   l_khasraw, r229, grp, 'lecture', 'weekly', 3, '13:00', '15:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_csl,  l_nian,    r205, grp, 'lab',     'weekly', 4, '09:00', '11:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_ecl,  l_khasraw, r109, grp, 'lab',     'weekly', 4, '11:00', '13:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_eng,  l_soma,    r229, grp, 'lecture', 'weekly', 4, '13:00', '15:00', '2026-09-01', '2027-06-30');
end $$;
