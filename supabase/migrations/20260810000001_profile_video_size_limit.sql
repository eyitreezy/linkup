-- Set 30MB file size limit on profile intro videos bucket.
UPDATE storage.buckets
SET file_size_limit = 31457280
WHERE name = 'profile-videos';
