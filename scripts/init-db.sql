-- Create databases for each service
CREATE DATABASE cab_rides;
CREATE DATABASE cab_payments;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE cab_rides TO postgres;
GRANT ALL PRIVILEGES ON DATABASE cab_payments TO postgres;
