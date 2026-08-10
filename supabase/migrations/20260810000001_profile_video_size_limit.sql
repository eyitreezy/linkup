-- Set 100MB file size limit on profile intro videos bucket.
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE name = 'profile-videos';
