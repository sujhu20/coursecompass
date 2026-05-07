SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    stream VARCHAR(100),
    percentage FLOAT,
    interests TEXT,
    streak INT DEFAULT 0,
    last_streak_date DATE,
    xp INT DEFAULT 0,
    profile_photo VARCHAR(255),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

DROP TABLE IF EXISTS courses;
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    stream VARCHAR(100) NOT NULL,
    min_percentage FLOAT NOT NULL,
    description TEXT,
    youtube_id VARCHAR(100),
    duration_months INT
  );

DROP TABLE IF EXISTS bookmarks;
CREATE TABLE IF NOT EXISTS bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
  );

DROP TABLE IF EXISTS progress;
CREATE TABLE IF NOT EXISTS progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'not_started',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
  );

DROP TABLE IF EXISTS ratings;
CREATE TABLE IF NOT EXISTS ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    stars INT NOT NULL,
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
  );

DROP TABLE IF EXISTS career_map;
CREATE TABLE IF NOT EXISTS career_map (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    career_name VARCHAR(255) NOT NULL,
    job_role VARCHAR(255),
    description TEXT
  );

DROP TABLE IF EXISTS salary_info;
CREATE TABLE IF NOT EXISTS salary_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    career_id INT NOT NULL,
    entry_level_salary INT,
    mid_level_salary INT,
    senior_level_salary INT
  );

DROP TABLE IF EXISTS badges;
CREATE TABLE IF NOT EXISTS badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    badge_type VARCHAR(100) NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_type)
  );

DROP TABLE IF EXISTS notifications;
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    `read` BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

DROP TABLE IF EXISTS streaks;
CREATE TABLE IF NOT EXISTS streaks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_visit DATE,
    UNIQUE(user_id)
  );

DROP TABLE IF EXISTS skill_ratings;
CREATE TABLE IF NOT EXISTS skill_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    skill VARCHAR(255) NOT NULL,
    rating INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE(user_id, skill)
  );

DROP TABLE IF EXISTS eligibility_rules;
CREATE TABLE IF NOT EXISTS eligibility_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    rule_type VARCHAR(100),
    required_value VARCHAR(255)
  );

-- Data for users
INSERT INTO users (`id`, `email`, `password`, `name`, `stream`, `percentage`, `interests`, `profile_photo`, `created_at`, `is_admin`) VALUES
(1, 'verify@test.com', '$2b$10$VuHiL8CH39sUNC1jaM5NOONREFvhzoW2UQmP5xyIFE9lpfgzMUywu', NULL, NULL, NULL, NULL, NULL, '2026-03-26 08:44:45', 0),
(2, 'test@audit.com', '$2b$10$vbw9jCjfpWoBhxmRlQVtjOGu061DUS0uGHsgxT/XnJbikuJnRQw66', NULL, NULL, NULL, NULL, NULL, '2026-03-31 04:28:35', 0),
(3, 'fix@test.com', '$2b$10$S0EQlzCWJ0.4RFxh9yY31.piwTiyBXDdBv1YQNtrpopKo6U/Cwkxy', NULL, NULL, NULL, NULL, NULL, '2026-03-31 05:08:35', 0),
(4, 'suraaj1000@gmail.com', '$2b$10$nx545Bm5Bp4ykPAbYbmC0OGSp9ztOjXXN1KTSwL5gS0dcMQxHVbdy', NULL, NULL, NULL, NULL, NULL, '2026-03-31 05:13:59', 0),
(5, 'admin@test.com', '$2b$10$VxDEFNufTVKy6EnWeQLyw.392WXJKUVsgCAusiEys1i5nYG/sPgn.', NULL, NULL, NULL, NULL, NULL, '2026-03-31 05:18:02', 0),
(6, 'sujhudahal@gmail.com', '$2b$10$FXcTDRCQ4cGxTTxFDfLvte6d/.RIoiuAZAin85OospwDNToZzapo6', NULL, NULL, NULL, NULL, NULL, '2026-04-23 06:12:02', 0),
(7, 'test@example.com', '$2b$10$A.d4ydyucXzndQdz8SPGWObIM8kMYK8zdM5Pf6KIvAjYg0eeSzGsC', NULL, NULL, NULL, NULL, NULL, '2026-04-23 06:12:52', 0);

-- Data for streaks
INSERT INTO streaks (`id`, `user_id`, `current_streak`, `longest_streak`, `last_visit`) VALUES
(1, 2, 1, 1, '2026-03-31'),
(2, 3, 1, 1, '2026-03-31'),
(3, 4, 1, 1, '2026-04-02'),
(4, 5, 1, 1, '2026-03-31');

-- Data for notifications
INSERT INTO notifications (`id`, `user_id`, `message`, `type`, `read`, `created_at`) VALUES
(1, 2, 'Badge Earned: First Steps!', 'badge', 0, '2026-03-26 09:15:59'),
(2, 3, 'Badge Earned: First Steps!', 'badge', 0, '2026-03-31 05:09:02'),
(3, 4, 'Badge Earned: First Steps!', 'badge', 0, '2026-03-31 05:14:00'),
(4, 5, 'Badge Earned: First Steps!', 'badge', 0, '2026-03-31 05:18:41'),
(5, 4, 'Badge Earned: First Bookmark!', 'badge', 0, '2026-04-28 05:09:06');

-- Data for salary_info
INSERT INTO salary_info (`id`, `career_id`, `entry_level_salary`, `mid_level_salary`, `senior_level_salary`) VALUES
(6131, 6131, 32000, 68000, 138000),
(6132, 6132, 40000, 85000, 165000),
(6133, 6133, 55000, 115000, 210000),
(6134, 6137, 30000, 62000, 122000),
(6135, 6138, 38000, 78000, 152000),
(6136, 6139, 35000, 70000, 138000),
(6137, 6140, 38000, 80000, 162000),
(6138, 6141, 35000, 75000, 148000),
(6139, 6142, 36000, 72000, 140000),
(6140, 6143, 38000, 78000, 152000),
(6141, 6144, 35000, 72000, 140000),
(6142, 6145, 45000, 95000, 182000),
(6143, 6146, 30000, 60000, 118000),
(6144, 6147, 20000, 45000, 90000),
(6145, 6148, 18000, 38000, 76000),
(6146, 6149, 22000, 48000, 95000),
(6147, 6150, 30000, 62000, 122000),
(6148, 6151, 32000, 65000, 130000),
(6149, 6152, 28000, 58000, 115000),
(6150, 6153, 32000, 65000, 130000),
(6151, 6154, 35000, 70000, 138000),
(6152, 6155, 30000, 62000, 125000),
(6153, 6156, 40000, 80000, 150000),
(6154, 6157, 45000, 90000, 160000),
(6155, 6158, 50000, 100000, 180000),
(6156, 6159, 42000, 88000, 165000),
(6157, 6160, 55000, 110000, 200000),
(6158, 6161, 28000, 60000, 118000),
(6159, 6162, 38000, 80000, 158000),
(6160, 6163, 35000, 72000, 142000),
(6161, 6164, 30000, 65000, 130000),
(6162, 6165, 22000, 48000, 95000),
(6163, 6166, 32000, 68000, 135000),
(6164, 6167, 22000, 50000, 100000),
(6165, 6168, 25000, 55000, 108000),
(6166, 6169, 60000, 150000, 350000),
(6167, 6170, 80000, 200000, 500000),
(6168, 6171, 90000, 250000, 600000),
(6169, 6172, 65000, 160000, 400000),
(6170, 6173, 40000, 100000, 250000),
(6171, 6174, 50000, 140000, 350000),
(6172, 6175, 55000, 150000, 380000),
(6173, 6176, 28000, 60000, 122000),
(6174, 6177, 25000, 55000, 108000),
(6175, 6178, 30000, 65000, 132000),
(6176, 6179, 25000, 52000, 105000),
(6177, 6180, 20000, 42000, 85000),
(6178, 6181, 22000, 45000, 90000),
(6179, 6182, 30000, 65000, 130000),
(6180, 6183, 35000, 72000, 145000),
(6181, 6184, 25000, 55000, 118000),
(6182, 6185, 35000, 70000, 150000),
(6183, 6186, 20000, 45000, 100000),
(6184, 6187, 30000, 65000, 140000),
(6185, 6188, 20000, 45000, 90000),
(6186, 6189, 25000, 55000, 112000),
(6187, 6190, 18000, 40000, 82000),
(6188, 6191, 28000, 62000, 125000),
(6189, 6192, 28000, 60000, 120000),
(6190, 6193, 30000, 65000, 130000),
(6191, 6194, 32000, 68000, 135000),
(6192, 6195, 30000, 65000, 130000),
(6193, 6196, 32000, 68000, 135000),
(6194, 6197, 28000, 60000, 120000),
(6195, 6198, 30000, 70000, 150000),
(6196, 6199, 28000, 65000, 138000),
(6197, 6200, 28000, 62000, 130000),
(6198, 6201, 32000, 70000, 140000),
(6199, 6202, 30000, 65000, 130000),
(6200, 6203, 22000, 50000, 100000),
(6201, 6204, 20000, 44000, 88000),
(6202, 6205, 25000, 55000, 108000),
(6203, 6206, 50000, 150000, 300000),
(6204, 6207, 45000, 130000, 260000),
(6205, 6208, 80000, 180000, 400000),
(6206, 6209, 25000, 55000, 112000),
(6207, 6210, 20000, 44000, 88000),
(6208, 6211, 28000, 60000, 120000),
(6209, 6212, 20000, 45000, 90000),
(6210, 6213, 22000, 48000, 95000),
(6211, 6214, 18000, 42000, 85000),
(6212, 6215, 25000, 55000, 112000),
(6213, 6216, 56000, 120000, 250000),
(6214, 6217, 28000, 58000, 115000),
(6215, 6218, 18000, 42000, 88000),
(6216, 6219, 25000, 55000, 112000),
(6217, 6220, 20000, 45000, 90000),
(6218, 6221, 25000, 65000, 200000),
(6219, 6222, 40000, 90000, 210000),
(6220, 6223, 35000, 75000, 162000),
(6221, 6224, 28000, 62000, 125000),
(6222, 6225, 25000, 55000, 110000),
(6223, 6226, 26000, 58000, 115000),
(6224, 6227, 30000, 68000, 138000),
(6225, 6228, 35000, 75000, 155000),
(6226, 6229, 32000, 70000, 142000),
(6227, 6230, 30000, 65000, 132000),
(6228, 6231, 38000, 82000, 165000),
(6229, 6232, 56000, 120000, 250000),
(6230, 6233, 45000, 100000, 220000),
(6231, 6234, 42000, 92000, 200000),
(6232, 6235, 28000, 65000, 140000),
(6233, 6236, 25000, 58000, 120000),
(6234, 6237, 22000, 52000, 108000),
(6235, 6238, 20000, 45000, 92000),
(6236, 6239, 25000, 58000, 120000),
(6237, 6240, 22000, 50000, 102000),
(6238, 6134, 52000, 108000, 195000),
(6239, 6135, 48000, 98000, 185000),
(6240, 6136, 32000, 65000, 130000),
(6241, 6241, 38000, 78000, 155000),
(6242, 6245, 28000, 60000, 115000),
(6243, 6243, 35000, 75000, 150000),
(6244, 6244, 25000, 55000, 108000),
(6245, 6248, 18000, 42000, 85000),
(6246, 6246, 22000, 50000, 108000),
(6247, 6247, 20000, 44000, 90000),
(6248, 6242, 50000, 105000, 200000);

-- Data for badges
INSERT INTO badges (`id`, `user_id`, `badge_type`, `earned_at`) VALUES
(1, 2, 'first_login', '2026-03-26 09:15:59'),
(17, 3, 'first_login', '2026-03-31 05:09:02'),
(18, 4, 'first_login', '2026-03-31 05:14:00'),
(19, 5, 'first_login', '2026-03-31 05:18:41'),
(49, 4, 'first_bookmark', '2026-04-28 05:09:06');

-- Data for career_map
INSERT INTO career_map (`id`, `course_id`, `career_name`, `job_role`, `description`) VALUES
(6131, 1662, 'Security Analyst', 'SOC Analyst', 'Security Analyst position'),
(6132, 1662, 'Cybersecurity Engineer', 'Threat Intelligence Specialist', 'Cybersecurity Engineer position'),
(6133, 1661, 'Data Scientist', 'AI Research Scientist', 'Data Scientist position'),
(6134, 1661, 'NLP Engineer', 'Natural Language Processing Specialist', 'NLP Engineer position'),
(6135, 1661, 'Data Engineer', 'Big Data / Pipeline Engineer', 'Data Engineer position'),
(6136, 1664, 'Mechanical Design Engineer', 'CAD/CAM Specialist', 'Mechanical Design Engineer position'),
(6137, 1664, 'Manufacturing Engineer', 'Production Lead', 'Manufacturing Engineer position'),
(6138, 1664, 'Robotics Engineer', 'Automation Engineer', 'Robotics Engineer position'),
(6139, 1664, 'Automotive Engineer', 'Vehicle Design Engineer', 'Automotive Engineer position'),
(6140, 1663, 'VLSI Design Engineer', 'Chip Design Specialist', 'VLSI Design Engineer position'),
(6141, 1663, 'Embedded Systems Engineer', 'Firmware Developer', 'Embedded Systems Engineer position'),
(6142, 1663, 'Telecom Engineer', 'RF & Network Engineer', 'Telecom Engineer position'),
(6143, 1663, 'IoT Engineer', 'IoT Solutions Developer', 'IoT Engineer position'),
(6144, 1667, 'Process Engineer', 'Chemical Plant Engineer', 'Process Engineer position'),
(6145, 1667, 'Petroleum Engineer', 'Oil & Gas Engineer', 'Petroleum Engineer position'),
(6146, 1667, 'Food Technology Engineer', 'Food Processing Specialist', 'Food Technology Engineer position'),
(6147, 1668, 'Junior Web Developer', 'Frontend/React Developer', 'Junior Web Developer position'),
(6148, 1668, 'IT Support Engineer', 'Systems Administrator', 'IT Support Engineer position'),
(6149, 1668, 'Network Administrator', 'Network Operations Engineer', 'Network Administrator position'),
(6150, 1665, 'Structural Engineer', 'Structural Design Lead', 'Structural Engineer position'),
(6151, 1665, 'Construction Manager', 'Site Project Manager', 'Construction Manager position'),
(6152, 1665, 'Urban Planner', 'Infrastructure Planning Consultant', 'Urban Planner position'),
(6153, 1666, 'Power Systems Engineer', 'Electrical Grid Engineer', 'Power Systems Engineer position'),
(6154, 1666, 'Control Systems Engineer', 'Automation & Control Specialist', 'Control Systems Engineer position'),
(6155, 1666, 'Energy Consultant', 'Sustainable Energy Analyst', 'Energy Consultant position'),
(6156, 1660, 'Software Engineer', 'Full-stack Developer', 'Software Engineer position'),
(6157, 1660, 'Data Scientist', 'ML/AI Engineer', 'Data Scientist position'),
(6158, 1660, 'DevOps Engineer', 'Cloud Architect', 'DevOps Engineer position'),
(6159, 1660, 'Cybersecurity Analyst', 'Security Operations Engineer', 'Cybersecurity Analyst position'),
(6160, 1660, 'Solutions Architect', 'Enterprise Architect', 'Solutions Architect position'),
(6161, 1672, 'Data Analyst', 'Business Intelligence Analyst', 'Data Analyst position'),
(6162, 1672, 'Machine Learning Engineer', 'AI Model Developer', 'Machine Learning Engineer position'),
(6163, 1672, 'Data Engineer', 'ETL / Pipeline Engineer', 'Data Engineer position'),
(6164, 1673, 'Physicist', 'Research Scientist', 'Physicist position'),
(6165, 1673, 'Physics Teacher / Lecturer', 'Academic Educator', 'Physics Teacher / Lecturer position'),
(6166, 1673, 'Optical / Instrumentation Engineer', 'Photonics Specialist', 'Optical / Instrumentation Engineer position'),
(6167, 1669, 'Junior Cybersecurity Analyst', 'Network Security Technician', 'Junior Cybersecurity Analyst position'),
(6168, 1669, 'Ethical Hacker (Junior)', 'Penetration Testing Analyst', 'Ethical Hacker (Junior) position'),
(6169, 1675, 'General Physician', 'Medical Doctor', 'General Physician position'),
(6170, 1675, 'Surgeon', 'Specialist Surgeon', 'Surgeon position'),
(6171, 1675, 'Cardiologist', 'Heart Specialist', 'Cardiologist position'),
(6172, 1675, 'Pediatrician', 'Child Health Specialist', 'Pediatrician position'),
(6173, 1676, 'Dental Surgeon', 'General Dentist', 'Dental Surgeon position'),
(6174, 1676, 'Orthodontist', 'Braces & Alignment Specialist', 'Orthodontist position'),
(6175, 1676, 'Oral Surgeon', 'Maxillofacial Surgeon', 'Oral Surgeon position'),
(6176, 1677, 'Biotech Researcher', 'R&D Scientist', 'Biotech Researcher position'),
(6177, 1677, 'Quality Control Analyst', 'QA/QC Specialist (Pharma)', 'Quality Control Analyst position'),
(6178, 1677, 'Genetic Counsellor', 'Clinical Genetics Specialist', 'Genetic Counsellor position'),
(6179, 1678, 'Microbiologist', 'Clinical / Industrial Microbiologist', 'Microbiologist position'),
(6180, 1678, 'Medical Lab Technician', 'Diagnostic Lab Analyst', 'Medical Lab Technician position'),
(6181, 1678, 'Food Safety Inspector', 'Food Quality Analyst', 'Food Safety Inspector position'),
(6182, 1679, 'Geneticist', 'Research Geneticist', 'Geneticist position'),
(6183, 1679, 'Bioinformatics Analyst', 'Genomics Data Scientist', 'Bioinformatics Analyst position'),
(6184, 1680, 'Hospital Pharmacist', 'Clinical Pharmacist', 'Hospital Pharmacist position'),
(6185, 1680, 'Drug Inspector', 'Government Drug Controller', 'Drug Inspector position'),
(6186, 1680, 'Medical Representative', 'Pharma Sales Executive', 'Medical Representative position'),
(6187, 1680, 'Research Scientist (Pharma)', 'Drug Development Researcher', 'Research Scientist (Pharma) position'),
(6188, 1681, 'Staff Nurse', 'Hospital Ward Nurse', 'Staff Nurse position'),
(6189, 1681, 'ICU Nurse', 'Critical Care Specialist', 'ICU Nurse position'),
(6190, 1681, 'Community Health Nurse', 'Public Health Nurse', 'Community Health Nurse position'),
(6191, 1681, 'Nursing Supervisor', 'Head Nurse / Nursing Manager', 'Nursing Supervisor position'),
(6192, 1682, 'Accountant', 'Senior Financial Analyst', 'Accountant position'),
(6193, 1682, 'Auditor', 'Internal / External Auditor', 'Auditor position'),
(6194, 1682, 'Tax Consultant', 'GST / Income Tax Advisor', 'Tax Consultant position'),
(6195, 1683, 'Business Analyst', 'Strategy Consultant', 'Business Analyst position'),
(6196, 1683, 'Operations Manager', 'Process / Ops Lead', 'Operations Manager position'),
(6197, 1683, 'HR Manager', 'People & Culture Manager', 'HR Manager position'),
(6198, 1674, 'Architect', 'Licensed Registered Architect', 'Architect position'),
(6199, 1674, 'Urban Designer', 'City Planning Consultant', 'Urban Designer position'),
(6200, 1674, 'Interior Architect', 'Commercial Space Designer', 'Interior Architect position'),
(6201, 1685, 'Business Intelligence Analyst', 'BI & Analytics Engineer', 'Business Intelligence Analyst position'),
(6202, 1685, 'Data Analyst (Commerce)', 'Financial Data Analyst', 'Data Analyst (Commerce) position'),
(6203, 1671, 'Software Developer', 'Application Developer', 'Software Developer position'),
(6204, 1671, 'System Administrator', 'IT Infrastructure Manager', 'System Administrator position'),
(6205, 1671, 'Database Developer', 'SQL/NoSQL Specialist', 'Database Developer position'),
(6206, 1686, 'Chartered Accountant', 'CA / Audit Partner', 'Chartered Accountant position'),
(6207, 1686, 'Tax Consultant', 'Senior Tax Advisor', 'Tax Consultant position'),
(6208, 1686, 'CFO', 'Chief Financial Officer', 'CFO position'),
(6209, 1688, 'Clinical Psychologist', 'Counsellor / Therapist', 'Clinical Psychologist position'),
(6210, 1688, 'School Counsellor', 'Student Welfare Counsellor', 'School Counsellor position'),
(6211, 1688, 'HR Specialist', 'People & Culture Specialist', 'HR Specialist position'),
(6212, 1689, 'Content Writer / Editor', 'Senior Copy Editor', 'Content Writer / Editor position'),
(6213, 1689, 'Copywriter', 'Creative Content Strategist', 'Copywriter position'),
(6214, 1689, 'English Teacher / Lecturer', 'Language & Literature Educator', 'English Teacher / Lecturer position'),
(6215, 1690, 'Political Analyst', 'Policy Research Analyst', 'Political Analyst position'),
(6216, 1690, 'Civil Services Officer', 'IAS / IPS / IFS Officer', 'Civil Services Officer position'),
(6217, 1690, 'NGO Programme Manager', 'Development Sector Lead', 'NGO Programme Manager position'),
(6218, 1691, 'Journalist / Reporter', 'News Reporter & Editor', 'Journalist / Reporter position'),
(6219, 1691, 'Public Relations Manager', 'PR & Communications Lead', 'Public Relations Manager position'),
(6220, 1691, 'Digital Content Creator', 'Video / Social Media Producer', 'Digital Content Creator position'),
(6221, 1692, 'Advocate / Lawyer', 'District / High Court Advocate', 'Advocate / Lawyer position'),
(6222, 1692, 'Corporate Legal Advisor', 'In-house Legal Counsel', 'Corporate Legal Advisor position'),
(6223, 1692, 'Public Prosecutor', 'Criminal Court Prosecutor', 'Public Prosecutor position'),
(6224, 1684, 'Digital Marketer', 'Performance Marketing Manager', 'Digital Marketer position'),
(6225, 1684, 'SEO / SEM Specialist', 'Search Marketing Analyst', 'SEO / SEM Specialist position'),
(6226, 1684, 'Content Strategist', 'Brand Content Manager', 'Content Strategist position'),
(6227, 1694, 'UI/UX Designer', 'Product Interface Designer', 'UI/UX Designer position'),
(6228, 1694, 'Product Designer', 'End-to-End Product Design Lead', 'Product Designer position'),
(6229, 1694, 'Interaction Designer', 'User Research & Prototyping Specialist', 'Interaction Designer position'),
(6230, 1687, 'Economist', 'Research Economist / Policy Analyst', 'Economist position'),
(6231, 1687, 'Investment Analyst', 'Equity Research Analyst', 'Investment Analyst position'),
(6232, 1687, 'Civil Services Officer', 'IAS / IES / IRS Officer', 'Civil Services Officer position'),
(6233, 1693, 'Corporate Lawyer', 'M&A / Contract Lawyer', 'Corporate Lawyer position'),
(6234, 1693, 'Compliance Manager', 'Corporate Governance Specialist', 'Compliance Manager position'),
(6235, 1697, 'Hotel Manager', 'Property / General Manager', 'Hotel Manager position'),
(6236, 1697, 'Revenue Manager', 'Hospitality Revenue Analyst', 'Revenue Manager position'),
(6237, 1697, 'Food & Beverage Manager', 'F&B Operations Manager', 'Food & Beverage Manager position'),
(6238, 1697, 'Event Coordinator', 'MICE & Events Manager', 'Event Coordinator position'),
(6239, 1696, 'Interior Designer', 'Residential / Commercial Space Designer', 'Interior Designer position'),
(6240, 1696, 'Space Planner', 'Furniture & Layout Specialist', 'Space Planner position'),
(6241, 1662, 'Digital Forensics Analyst', 'Incident Response Analyst', 'Digital Forensics Analyst position'),
(6242, 1661, 'AI/ML Engineer', 'Machine Learning Specialist', 'AI/ML Engineer position'),
(6243, 1662, 'Ethical Hacker', 'Penetration Tester', 'Ethical Hacker position'),
(6244, 1670, 'Data Analyst', 'Business Intelligence Analyst', 'Data Analyst position'),
(6245, 1670, 'Junior Data Scientist', 'ML Operations Analyst', 'Junior Data Scientist position'),
(6246, 1695, 'Fashion Designer', 'Apparel & Garment Designer', 'Fashion Designer position'),
(6247, 1695, 'Textile Designer', 'Fabric & Pattern Specialist', 'Textile Designer position'),
(6248, 1695, 'Fashion Stylist', 'Editorial & Commercial Stylist', 'Fashion Stylist position');

-- Data for courses
INSERT INTO courses (`id`, `name`, `stream`, `min_percentage`, `description`, `youtube_id`, `duration_months`) VALUES
(1660, 'B.Tech Computer Science Engineering (CSE)', 'PCM', 60, '4-year B.Tech in Computer Science — software engineering, algorithms, operating systems, and systems design.', NULL, 48),
(1661, 'B.Tech Artificial Intelligence & Data Science', 'PCM', 60, '4-year B.Tech in AI, machine learning, deep learning, natural language processing, and data engineering.', NULL, 48),
(1662, 'B.Tech Cybersecurity', 'PCM', 60, '4-year B.Tech in network security, ethical hacking, cryptography, and cyber-threat management.', NULL, 48),
(1663, 'B.Tech Electronics & Communication (ECE)', 'PCM', 60, '4-year B.Tech in analog/digital electronics, communication systems, VLSI, and embedded design.', NULL, 48),
(1664, 'B.Tech Mechanical Engineering', 'PCM', 60, '4-year B.Tech in mechanics, thermodynamics, manufacturing processes, and robotics.', NULL, 48),
(1665, 'B.Tech Civil Engineering', 'PCM', 60, '4-year B.Tech in structural design, construction management, and infrastructure planning.', NULL, 48),
(1666, 'B.Tech Electrical Engineering', 'PCM', 60, '4-year B.Tech in power systems, control engineering, and electrical circuit design.', NULL, 48),
(1667, 'B.Tech Chemical Engineering', 'PCM', 60, '4-year B.Tech in chemical processes, petroleum engineering, and industrial chemistry.', NULL, 48),
(1668, 'BCA Information Technology', 'PCM', 50, '3-year BCA in IT infrastructure, web technologies, databases, and enterprise software development.', NULL, 36),
(1669, 'BCA Cybersecurity', 'PCM', 50, '3-year BCA specialising in ethical hacking, network security, digital forensics, and compliance.', NULL, 36),
(1670, 'BCA Data Analytics', 'PCM', 50, '3-year BCA in data analytics, business intelligence, SQL, Python, and data visualisation.', NULL, 36),
(1671, 'B.Sc Computer Science', 'PCM', 50, '3-year B.Sc in programming, algorithms, operating systems, databases, and software engineering.', NULL, 36),
(1672, 'B.Sc Data Science', 'PCM', 50, '3-year B.Sc in statistics, machine learning, data analysis, and Python/R programming.', NULL, 36),
(1673, 'B.Sc Physics', 'PCM', 50, '3-year B.Sc Physics covering classical mechanics, optics, quantum physics, and applied research.', NULL, 36),
(1674, 'B.Arch (Architecture)', 'PCM', 50, '5-year professional architecture degree — building design, structural systems, urban planning, and sustainable architecture.', NULL, 60),
(1675, 'MBBS (Bachelor of Medicine & Surgery)', 'PCB', 50, '5.5-year professional medical degree — the standard qualification to become a licensed physician in India.', NULL, 66),
(1676, 'BDS (Bachelor of Dental Surgery)', 'PCB', 50, '5-year dental surgery degree for clinical dental practice and oral healthcare.', NULL, 60),
(1677, 'B.Sc Biotechnology', 'PCB', 50, '3-year B.Sc in genetics, cell biology, biomedical research, bioinformatics, and biotech applications.', NULL, 36),
(1678, 'B.Sc Microbiology', 'PCB', 50, '3-year B.Sc studying microorganisms, infectious diseases, lab diagnostics, and applied microbiology.', NULL, 36),
(1679, 'B.Sc Genetics', 'PCB', 50, '3-year B.Sc in heredity, genomics, molecular biology, and genetic counselling.', NULL, 36),
(1680, 'B.Pharm (Bachelor of Pharmacy)', 'PCB', 50, '4-year pharmacy degree in drug formulation, pharmaceutical sciences, pharmacology, and clinical pharmacy.', NULL, 48),
(1681, 'B.Sc Nursing', 'PCB', 50, '4-year nursing degree covering patient care, clinical procedures, community health, and nursing management.', NULL, 48),
(1682, 'B.Com (Hons)', 'Commerce', 50, '3-year honours degree in corporate finance, advanced accounting, business law, and economic analysis.', NULL, 36),
(1683, 'BBA Business Administration', 'Commerce', 50, '3-year BBA in core business strategy, operations management, marketing, and organisational behaviour.', NULL, 36),
(1684, 'BBA Digital Marketing', 'Commerce', 50, '3-year BBA specialising in SEO, social media campaigns, content strategy, and performance marketing.', NULL, 36),
(1685, 'BBA Business Analytics', 'Commerce', 50, '3-year BBA in data-driven business decisions using statistics, Excel, Power BI, and Python.', NULL, 36),
(1686, 'Chartered Accountancy (CA)', 'Commerce', 33, 'Professional CA qualification from ICAI — India''s premier credential in accounting, auditing, and taxation.', NULL, 60),
(1687, 'B.Com Economics (Hons)', 'Commerce', 60, '3-year combined commerce and economics degree — macroeconomics, econometrics, and public-policy analysis.', NULL, 36),
(1688, 'BA Psychology', 'Humanities', 50, '3-year BA in human behaviour, counselling theories, developmental, clinical, and social psychology.', NULL, 36),
(1689, 'BA English (Hons)', 'Humanities', 50, '3-year honours degree in English literature, linguistics, and academic and creative writing.', NULL, 36),
(1690, 'BA Political Science (Hons)', 'Humanities', 50, '3-year degree in governance, public policy, comparative politics, and international relations.', NULL, 36),
(1691, 'BJMC (Journalism & Mass Communication)', 'Humanities', 50, '3-year degree in broadcast, print, and digital journalism, public relations, advertising, and media ethics.', NULL, 36),
(1692, 'BA LLB (Integrated Law)', 'Humanities', 45, '5-year integrated BA + LLB — combines arts and humanities with a complete legal education.', NULL, 60),
(1693, 'BBA LLB (Integrated Law)', 'Humanities', 45, '5-year integrated BBA + LLB — business law, corporate governance, and commercial litigation.', NULL, 60),
(1694, 'B.Des UI/UX Design', 'All', 50, '4-year design degree in user interface and interaction design, design thinking, and digital prototyping.', NULL, 48),
(1695, 'B.Des Fashion Design', 'All', 50, '4-year fashion design degree — garment construction, textile design, fashion illustration, and styling.', NULL, 48),
(1696, 'B.Des Interior Design', 'All', 50, '4-year degree in interior aesthetics, space planning, materials, lighting, and sustainable design.', NULL, 48),
(1697, 'B.Sc Hotel Management', 'All', 50, '3-4 year degree for careers in hotel operations, food & beverage management, tourism, and event coordination.', NULL, 42);

SET FOREIGN_KEY_CHECKS = 1;
