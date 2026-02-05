-- Create databases for each service with standardized naming (_db suffix)
CREATE DATABASE auth_db;
CREATE DATABASE user_db;
CREATE DATABASE driver_db;
CREATE DATABASE booking_db;
CREATE DATABASE ride_db;
CREATE DATABASE payment_db;
CREATE DATABASE pricing_db;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE auth_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE user_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE driver_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE booking_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE ride_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE payment_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE pricing_db TO postgres;
