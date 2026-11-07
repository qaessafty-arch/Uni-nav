-- SUE · Year 1 (UG1), section P/R — timetable as provided by a student (2026-11-07).
-- Run after ug1_cc_timetable.sql (reuses its building, floors, courses, semester).
-- Same assumptions: Electrical Engineering; whole year 2026-2027; UNVERIFIED. Idempotent.
do $$
declare
  u uuid; dept uuid; bld uuid; f2 uuid; sem uuid; grp uuid; r109 uuid; r205 uuid; r226 uuid;
  l_miaad uuid; l_khasraw uuid; l_soma uuid; l_nian uuid; l_rebaz uuid; l_goran uuid;
  c_eng uuid; c_ec uuid; c_ecl uuid; c_cs uuid; c_csl uuid; c_kurd uuid; c_math uuid; c_algo uuid;
begin
  select id into u from public.universities where slug = 'sue';
  select id into dept from public.departments where university_id = u and name->>'en' = 'Electrical Engineering' and college->>'en' = 'College of Engineering';
  select id into bld from public.buildings where university_id = u and code = 'ENG';
  select id into f2 from public.floors where building_id = bld and level = 2;
  select id into sem from public.semesters where university_id = u and academic_year = '2026-2027';
  if dept is null or bld is null or f2 is null or sem is null then raise exception 'run ug1_cc_timetable.sql first'; end if;

  select id into r226 from public.rooms where building_id = bld and code = 'E226' and deleted_at is null;
  if r226 is null then insert into public.rooms (university_id, building_id, floor_id, code, name, type, department_id, data_status) values (u, bld, f2, 'E226', '{"en":"Hall E226"}', 'classroom', dept, 'unverified') returning id into r226; end if;
  select id into r109 from public.rooms where building_id = bld and code = 'E109' and deleted_at is null;
  select id into r205 from public.rooms where building_id = bld and code = 'E205' and deleted_at is null;

  select id into l_miaad from public.lecturers where university_id = u and full_name->>'en' = 'Mrs. Miaad';
  if l_miaad is null then insert into public.lecturers (university_id, department_id, full_name, data_status) values (u, dept, '{"en":"Mrs. Miaad"}', 'unverified') returning id into l_miaad; end if;
  select id into l_khasraw from public.lecturers where university_id = u and full_name->>'en' = 'Mr. Khasraw';
  select id into l_soma from public.lecturers where university_id = u and full_name->>'en' = 'Ms. Soma';
  select id into l_nian from public.lecturers where university_id = u and full_name->>'en' = 'Mrs. Nian';
  select id into l_rebaz from public.lecturers where university_id = u and full_name->>'en' = 'Mr. Rebaz';
  select id into l_goran from public.lecturers where university_id = u and full_name->>'en' = 'Mr. Goran';

  select id into c_eng from public.courses where university_id = u and code = 'EE1-ENG' and deleted_at is null;
  select id into c_ec from public.courses where university_id = u and code = 'EE1-EC' and deleted_at is null;
  select id into c_ecl from public.courses where university_id = u and code = 'EE1-EC-LAB' and deleted_at is null;
  select id into c_cs from public.courses where university_id = u and code = 'EE1-CS' and deleted_at is null;
  select id into c_csl from public.courses where university_id = u and code = 'EE1-CS-LAB' and deleted_at is null;
  select id into c_kurd from public.courses where university_id = u and code = 'EE1-KURD' and deleted_at is null;
  select id into c_math from public.courses where university_id = u and code = 'EE1-MATH' and deleted_at is null;
  select id into c_algo from public.courses where university_id = u and code = 'EE1-ALGO' and deleted_at is null;

  select id into grp from public.student_groups where university_id = u and code = 'EE-UG1-PR' and academic_year = '2026-2027' and deleted_at is null;
  if grp is null then insert into public.student_groups (university_id, department_id, code, name, academic_year, stage) values (u, dept, 'EE-UG1-PR', '{"en":"Year 1 — Section P/R"}', '2026-2027', 1) returning id into grp; end if;

  delete from public.timetable_entries where group_id = grp;
  insert into public.timetable_entries (university_id, semester_id, course_id, lecturer_id, room_id, group_id, kind, recurrence, day, start_time, end_time, valid_from, valid_to) values
    (u, sem, c_math, l_miaad,   r226, grp, 'lecture', 'weekly', 0, '09:00', '11:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_ecl,  l_khasraw, r109, grp, 'lab',     'weekly', 0, '11:00', '13:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_eng,  l_soma,    r226, grp, 'lecture', 'weekly', 0, '13:00', '15:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_cs,   l_nian,    r226, grp, 'lecture', 'weekly', 1, '09:00', '11:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_ec,   l_khasraw, r226, grp, 'lecture', 'weekly', 1, '11:00', '13:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_math, l_miaad,   r226, grp, 'lecture', 'weekly', 2, '09:00', '11:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_kurd, l_rebaz,   r226, grp, 'lecture', 'weekly', 2, '11:00', '13:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_algo, l_goran,   r226, grp, 'lecture', 'weekly', 3, '09:00', '11:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_ec,   l_khasraw, r226, grp, 'lecture', 'weekly', 3, '11:00', '13:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_eng,  l_soma,    r226, grp, 'lecture', 'weekly', 4, '09:00', '11:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_csl,  l_nian,    r205, grp, 'lab',     'weekly', 4, '11:00', '13:00', '2026-09-01', '2027-06-30'),
    (u, sem, c_ecl,  l_khasraw, r109, grp, 'lab',     'weekly', 4, '13:00', '15:00', '2026-09-01', '2027-06-30');
end $$;

-- Clash check across Year 1 sections: same room or same lecturer at overlapping times.
select 'room' as clash, r.code as what, a.day, a.start_time, a.end_time, ga.code as g1, gb.code as g2
from public.timetable_entries a join public.timetable_entries b on a.id < b.id and a.day = b.day and a.room_id = b.room_id
  and a.start_time < b.end_time and b.start_time < a.end_time
join public.rooms r on r.id = a.room_id join public.student_groups ga on ga.id = a.group_id join public.student_groups gb on gb.id = b.group_id
where ga.code like 'EE-UG1-%' and gb.code like 'EE-UG1-%'
union all
select 'lecturer', l.full_name->>'en', a.day, a.start_time, a.end_time, ga.code, gb.code
from public.timetable_entries a join public.timetable_entries b on a.id < b.id and a.day = b.day and a.lecturer_id = b.lecturer_id
  and a.start_time < b.end_time and b.start_time < a.end_time
join public.lecturers l on l.id = a.lecturer_id join public.student_groups ga on ga.id = a.group_id join public.student_groups gb on gb.id = b.group_id
where ga.code like 'EE-UG1-%' and gb.code like 'EE-UG1-%';
