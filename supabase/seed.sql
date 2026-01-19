-- Sample test data for development

-- Insert test manager
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'manager@artificagent.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"full_name": "Test Manager", "role": "manager"}'::jsonb
);

-- Insert test agents
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES 
    (
        '00000000-0000-0000-0000-000000000002',
        'agent1@artificagent.com',
        crypt('password123', gen_salt('bf')),
        NOW(),
        '{"full_name": "Ahmet Yılmaz", "role": "agent"}'::jsonb
    ),
    (
        '00000000-0000-0000-0000-000000000003',
        'agent2@artificagent.com',
        crypt('password123', gen_salt('bf')),
        NOW(),
        '{"full_name": "Mehmet Demir", "role": "agent"}'::jsonb
    ),
    (
        '00000000-0000-0000-0000-000000000004',
        'agent3@artificagent.com',
        crypt('password123', gen_salt('bf')),
        NOW(),
        '{"full_name": "Ayşe Kaya", "role": "agent"}'::jsonb
    );

-- Note: Profiles will be automatically created via trigger

-- Sample test leads (uncomment if needed)
/*
INSERT INTO upload_batches (id, uploaded_by, filename, total_leads)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'test_google_maps.csv',
    10
);

INSERT INTO leads (business_name, phone_number, address, category, website, rating, assigned_to, batch_id)
VALUES
    ('Cafe Istanbul', '+905321234567', 'İstiklal Cad. No:123, Beyoğlu', 'Coffee Shop', 'https://cafeistanbul.com', 4.5, '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010'),
    ('Tech Solutions Ltd', '+905329876543', 'Maslak Mah. Büyükdere Cad. No:45', 'IT Services', 'https://techsolutions.com', 4.8, '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010'),
    ('Gourmet Restaurant', '+905321112233', 'Nişantaşı, Teşvikiye Cad. No:78', 'Restaurant', NULL, 4.2, '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000010');
*/
