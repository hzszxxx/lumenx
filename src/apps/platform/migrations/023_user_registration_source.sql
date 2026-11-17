ALTER TABLE platform_users ADD COLUMN registered_invite_code TEXT;
ALTER TABLE platform_users ADD COLUMN registration_source TEXT DEFAULT 'open';
ALTER TABLE platform_users ADD COLUMN inviter_user_id TEXT;

-- 回填已有 agent_students 的数据
UPDATE platform_users
SET registered_invite_code = (
    SELECT invite_code FROM agent_students WHERE agent_students.student_user_id = platform_users.id
),
registration_source = 'agent',
inviter_user_id = (
    SELECT agent_id FROM agent_students WHERE agent_students.student_user_id = platform_users.id
)
WHERE id IN (SELECT student_user_id FROM agent_students);

-- 回填已有测试码激活绑定的数据
UPDATE platform_users
SET registration_source = 'test_access'
WHERE id IN (SELECT user_id FROM platform_test_access_bindings)
  AND (registration_source IS NULL OR registration_source = 'open');
