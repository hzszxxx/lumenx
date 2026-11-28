-- 029_fix_course_video_urls.sql
-- 将预置课程不可访问的外部 demo 视频地址更新为站内可用样片路径
UPDATE courses
SET video_url = '/sample-assets/sample_preview.mp4'
WHERE video_url LIKE 'https://yingban.dajilin.net/assets/courses/%'
   OR video_url = '';
