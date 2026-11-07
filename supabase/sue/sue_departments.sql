-- Salahaddin University-Erbil (SUE): colleges and departments.
-- Source: each college's official site (URLs below) and https://su.edu.krd/about/regulations/admission
-- (17 colleges), retrieved 2026-11-07 with Firecrawl. Names are as published, in English.
-- Status: UNVERIFIED until the university confirms. Kurdish/Arabic names are left for the university to add.
-- programme length: 4 years (bachelor) by default; the admin sets other lengths per department.
-- Usage: run as an admin/owner of the 'sue' university (or via the SQL editor).
insert into public.departments (university_id, code, name, college, program_years)
select u.id, v.code, jsonb_build_object('en', v.name), jsonb_build_object('en', v.college), 4
from public.universities u, (values
  ('SCI-BIOL', 'Biology', 'College of Science'), -- https://science.su.edu.krd/
  ('SCI-CHEM', 'Chemistry', 'College of Science'), -- https://science.su.edu.krd/
  ('SCI-PHYS', 'Physics', 'College of Science'), -- https://science.su.edu.krd/
  ('SCI-MATH', 'Mathematics', 'College of Science'), -- https://science.su.edu.krd/
  ('SCI-GEOL', 'Geology', 'College of Science'), -- https://science.su.edu.krd/
  ('SCI-ES', 'Environmental Science', 'College of Science'), -- https://science.su.edu.krd/
  ('ENG-CIVI', 'Civil Engineering', 'College of Engineering'), -- https://engineering.su.edu.krd/
  ('ENG-ELEC', 'Electrical Engineering', 'College of Engineering'), -- https://engineering.su.edu.krd/
  ('ENG-MM', 'Mechanical and Mechatronics Engineering', 'College of Engineering'), -- https://engineering.su.edu.krd/
  ('ENG-ARCH', 'Architecture Engineering', 'College of Engineering'), -- https://engineering.su.edu.krd/
  ('ENG-SOFT', 'Software Engineering', 'College of Engineering'), -- https://engineering.su.edu.krd/
  ('ENG-WR', 'Water Resources Engineering', 'College of Engineering'), -- https://engineering.su.edu.krd/
  ('ENG-GS', 'Geomatics (Surveying) Engineering', 'College of Engineering'), -- https://engineering.su.edu.krd/
  ('ENG-CP', 'Chemical and Petrochemical Engineering', 'College of Engineering'), -- https://engineering.su.edu.krd/
  ('ENG-AVIA', 'Aviation Engineering', 'College of Engineering'), -- https://engineering.su.edu.krd/
  ('AGR-AR', 'Animal Resources', 'College of Agricultural Engineering Sciences'), -- https://agriculture.su.edu.krd/
  ('AGR-FT', 'Food Technology', 'College of Agricultural Engineering Sciences'), -- https://agriculture.su.edu.krd/
  ('AGR-PP', 'Plant Protection', 'College of Agricultural Engineering Sciences'), -- https://agriculture.su.edu.krd/
  ('AGR-FCMP', 'Field Crops and Medicinal Plants', 'College of Agricultural Engineering Sciences'), -- https://agriculture.su.edu.krd/
  ('AGR-SW', 'Soil and Water', 'College of Agricultural Engineering Sciences'), -- https://agriculture.su.edu.krd/
  ('AGR-FORE', 'Forestry', 'College of Agricultural Engineering Sciences'), -- https://agriculture.su.edu.krd/
  ('AGR-HLD', 'Horticulture and Landscaping Design', 'College of Agricultural Engineering Sciences'), -- https://agriculture.su.edu.krd/
  ('AGR-FHP', 'Fish Health and Production', 'College of Agricultural Engineering Sciences'), -- https://agriculture.su.edu.krd/
  ('EDU-BIOL', 'Biology', 'College of Education'), -- https://education.su.edu.krd/
  ('EDU-CHEM', 'Chemistry', 'College of Education'), -- https://education.su.edu.krd/
  ('EDU-PHYS', 'Physics', 'College of Education'), -- https://education.su.edu.krd/
  ('EDU-MATH', 'Mathematics', 'College of Education'), -- https://education.su.edu.krd/
  ('EDU-ARAB', 'Arabic Language', 'College of Education'), -- https://education.su.edu.krd/
  ('EDU-EPC', 'Educational and Psychological Counseling', 'College of Education'), -- https://education.su.edu.krd/
  ('EDU-SE', 'Special Education', 'College of Education'), -- https://education.su.edu.krd/
  ('EDU-KURD', 'Kurdish Language', 'College of Education'), -- https://education.su.edu.krd/
  ('EDU-ENGL', 'English Language', 'College of Education'), -- https://education.su.edu.krd/
  ('EDU-SYRI', 'Syriac Language', 'College of Education'), -- https://education.su.edu.krd/
  ('ADEC-ACCO', 'Accounting', 'College of Administration and Economics'), -- https://adminecon.su.edu.krd/
  ('ADEC-ECON', 'Economics', 'College of Administration and Economics'), -- https://adminecon.su.edu.krd/
  ('ADEC-STAT', 'Statistics', 'College of Administration and Economics'), -- https://adminecon.su.edu.krd/
  ('ADEC-ADMI', 'Administration', 'College of Administration and Economics'), -- https://adminecon.su.edu.krd/
  ('ADEC-FB', 'Finance and Banking', 'College of Administration and Economics'), -- https://adminecon.su.edu.krd/
  ('ADEC-MARK', 'Marketing', 'College of Administration and Economics'), -- https://adminecon.su.edu.krd/
  ('LAW-LAW', 'Law', 'College of Law'), -- https://law.su.edu.krd/
  ('BED-KURD', 'Kurdish Language', 'College of Basic Education'), -- https://basiceducation.su.edu.krd/
  ('BED-SS', 'Social Sciences', 'College of Basic Education'), -- https://basiceducation.su.edu.krd/
  ('BED-MATH', 'Mathematics', 'College of Basic Education'), -- https://basiceducation.su.edu.krd/
  ('BED-ENGL', 'English Language', 'College of Basic Education'), -- https://basiceducation.su.edu.krd/
  ('BED-GS', 'General Sciences', 'College of Basic Education'), -- https://basiceducation.su.edu.krd/
  ('BED-KIND', 'Kindergarten', 'College of Basic Education'), -- https://basiceducation.su.edu.krd/
  ('BED-ARAB', 'Arabic', 'College of Basic Education'), -- https://basiceducation.su.edu.krd/
  ('POL-PS', 'Political Science', 'College of Political Science'), -- https://politicalsciences.su.edu.krd/
  ('POL-IR', 'International Relations', 'College of Political Science'), -- https://politicalsciences.su.edu.krd/
  ('POL-PA', 'Public Administration', 'College of Political Science'), -- https://politicalsciences.su.edu.krd/
  ('ART-SOCI', 'Sociology', 'College of Arts'), -- https://arts.su.edu.krd/
  ('ART-HIST', 'History', 'College of Arts'), -- https://arts.su.edu.krd/
  ('ART-GEOG', 'Geography', 'College of Arts'), -- https://arts.su.edu.krd/
  ('ART-ARCH', 'Archaeology', 'College of Arts'), -- https://arts.su.edu.krd/
  ('ART-MEDI', 'Media', 'College of Arts'), -- https://arts.su.edu.krd/
  ('ART-PHIL', 'Philosophy', 'College of Arts'), -- https://arts.su.edu.krd/
  ('ART-SW', 'Social Work', 'College of Arts'), -- https://arts.su.edu.krd/
  ('ART-PSYC', 'Psychology', 'College of Arts'), -- https://arts.su.edu.krd/
  ('LANG-KURD', 'Kurdish Language', 'College of Languages'), -- https://language.su.edu.krd/
  ('LANG-ARAB', 'Arabic Language', 'College of Languages'), -- https://language.su.edu.krd/
  ('LANG-ENGL', 'English Language', 'College of Languages'), -- https://language.su.edu.krd/
  ('LANG-PERS', 'Persian Language', 'College of Languages'), -- https://language.su.edu.krd/
  ('LANG-FREN', 'French Language', 'College of Languages'), -- https://language.su.edu.krd/
  ('LANG-TURK', 'Turkish Language', 'College of Languages'), -- https://language.su.edu.krd/
  ('LANG-GERM', 'German Language', 'College of Languages'), -- https://language.su.edu.krd/
  ('LANG-CHIN', 'Chinese Language', 'College of Languages'), -- https://language.su.edu.krd/
  ('LANG-TRAN', 'Translation', 'College of Languages'), -- https://language.su.edu.krd/
  ('ISL-SHAR', 'Sharia', 'College of Islamic Sciences'), -- https://islamicsciences.su.edu.krd/
  ('ISL-IS', 'Islamic Studies', 'College of Islamic Sciences'), -- https://islamicsciences.su.edu.krd/
  ('ISL-RE', 'Religious Education', 'College of Islamic Sciences'), -- https://islamicsciences.su.edu.krd/
  ('ISL-PSRM', 'Public Speaking and Religious Media', 'College of Islamic Sciences'), -- https://islamicsciences.su.edu.krd/
  ('EDSH-KURD', 'Kurdish Language', 'College of Education, Shaqlawa'), -- https://edushaqlawa.su.edu.krd/
  ('EDSH-ENGL', 'English Language', 'College of Education, Shaqlawa'), -- https://edushaqlawa.su.edu.krd/
  ('EDSH-ARAB', 'Arabic Language', 'College of Education, Shaqlawa'), -- https://edushaqlawa.su.edu.krd/
  ('EDSH-BIOL', 'Biology', 'College of Education, Shaqlawa'), -- https://edushaqlawa.su.edu.krd/
  ('EDSH-PHYS', 'Physics', 'College of Education, Shaqlawa'), -- https://edushaqlawa.su.edu.krd/
  ('EDSH-PE', 'Physical Education', 'College of Education, Shaqlawa'), -- https://edushaqlawa.su.edu.krd/
  ('EDMK-KURD', 'Kurdish Language', 'College of Education, Makhmour'), -- https://edumakhmour.su.edu.krd/
  ('EDMK-ARAB', 'Arabic Language', 'College of Education, Makhmour'), -- https://edumakhmour.su.edu.krd/
  ('FART-SCUL', 'Sculpture', 'College of Fine Arts'), -- https://finearts.su.edu.krd/
  ('FART-MUSI', 'Music', 'College of Fine Arts'), -- https://finearts.su.edu.krd/
  ('FART-CT', 'Cinema and Theater', 'College of Fine Arts'), -- https://finearts.su.edu.krd/
  ('PES-PE', 'Physical Education', 'College of Physical Education and Sport Sciences'), -- https://physicaleducation.su.edu.krd/
  ('PES-SS', 'Sports Science', 'College of Physical Education and Sport Sciences'), -- https://physicaleducation.su.edu.krd/
  ('PES-PEST', 'Physical Education and Sports Training', 'College of Physical Education and Sport Sciences'), -- https://physicaleducation.su.edu.krd/
  ('VET-VM', 'Veterinary Medicine', 'College of Veterinary Medicine'), -- https://veterinarymedicine.su.edu.krd/
  ('CSI-CS', 'Computer Science', 'College of Computer Science and Informatics'), -- https://computing.su.edu.krd/
  ('CSI-IT', 'Information Technology', 'College of Computer Science and Informatics'), -- https://computing.su.edu.krd/
  ('CSI-AI', 'Artificial Intelligence', 'College of Computer Science and Informatics') -- https://computing.su.edu.krd/
) as v(code, name, college)
where u.slug = 'sue'
on conflict do nothing;
