# Rethink Finance NAV Backend

This backend service calculates and stores simulated NAV (Net Asset Value) for funds in the Rethink Finance platform.

## TODO: use monorepo structure with shared functions and types, not doing this now because there is another big PR open for flows V2 which will cause a lot of conflicts now...
### TODO: optimize code, first save fund data, then save nav updates data and then have a separate structure for calculated/simulated NAV values


## Features

- Calculate simulated NAV values for funds using blockchain data
- Store NAV values in a PostgreSQL database
- Scheduled NAV calculations for configured funds
- RESTful API for retrieving NAV values
- Docker support for easy deployment

## Prerequisites

- Docker
- Docker Compose

## Installation

### Local Docker Installation

Make sure Docker and Docker Compose are installed.

This will start both the backend service and a PostgreSQL database:
```bash
# Configure environment variables in `.env` file (see Configuration section)
# (Optional) Modify the environment variables in the `docker compose.yml` file in the backend directory

# From the rethink-frontend-v2 repository root run
docker compose up --build
# Add -d to run in a detached mode
docker compose up --build -d
```

#### Development vs Production

Two Docker Compose files are provided in the backend directory:

- `docker compose.yml`: For development, with source code mounting and database port exposure
- `docker compose.prod.yml`: For production, optimized for security and performance

To use the production configuration:

```bash
docker compose -f docker compose.prod.yml up -d
```

#### Docker Commands

For development:

- Navigate to the backend directory:
  ```bash
  cd backend
  ```

- Start the services:
  ```bash
  docker compose up -d
  ```

- View logs:
  ```bash
  docker compose logs -f backend
  ```

- Stop the services:
  ```bash
  docker compose down
  ```

- Rebuild the backend service:
  ```bash
  docker compose build backend
  ```

- Restart the backend service:
  ```bash
  docker compose restart backend
  ```

For production:

- Navigate to the backend directory:
  ```bash
  cd backend
  ```

- Start the services:
  ```bash
  docker compose -f docker compose.prod.yml up -d
  ```

- View logs:
  ```bash
  docker compose -f docker compose.prod.yml logs -f backend
  ```

- Stop the services:
  ```bash
  docker compose -f docker compose.prod.yml down
  ```

- Rebuild the backend service:
  ```bash
  docker compose -f docker compose.prod.yml build backend
  ```

- Restart the backend service:
  ```bash
  docker compose -f docker compose.prod.yml restart backend
  ```

#### Docker Environment Configuration

When using Docker, environment variables are defined in the `docker compose.yml` file in the backend directory instead of the `.env` file. You can modify these variables directly in the `docker compose.yml` file.

#### Docker Volumes

The Docker Compose configuration uses the following volumes:

- `postgres_data`: Persists PostgreSQL database data
- `backend_node_modules`: Preserves the Node.js modules installed during the Docker build (development only)

These volumes ensure that data is persisted between container restarts and that the Node.js modules are properly managed.

#### Customizing the Docker Setup

You can customize the Docker setup to fit your specific needs:

1. **Modifying the Dockerfile**:
   - Change the base image for different Node.js versions
   - Add additional dependencies
   - Modify build steps
   - Change the user or permissions

2. **Customizing docker compose.yml**:
   - Add additional services (e.g., Redis for caching)
   - Change port mappings
   - Modify volume configurations
   - Add environment-specific overrides with docker compose.override.yml

3. **Using Environment Variables**:
   - Create a `.env` file for docker compose to use
   - Use docker compose env_file directive
   - Pass environment variables directly to docker compose command

Example of adding Redis to docker compose.yml:
```yaml
services:
  # ... existing services

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  # ... existing volumes
  redis_data:
```

#### Production Security Considerations

When deploying to production, consider the following security measures:

1. **Environment Variables**: 
   - Use secrets management for sensitive values instead of environment variables in docker compose.yml
   - Consider using Docker Swarm secrets or Kubernetes secrets in production

2. **Database Security**:
   - Use strong, unique passwords for the database
   - Consider using a managed database service instead of a containerized database
   - Implement regular database backups

3. **Network Security**:
   - Use a reverse proxy (like Nginx) in front of the backend service
   - Implement HTTPS with proper certificates
   - Consider using a network firewall

4. **Container Security**:
   - Run containers with non-root users
   - Use container scanning tools to check for vulnerabilities
   - Keep Docker and all dependencies updated

5. **Monitoring and Logging**:
   - Implement proper logging and monitoring for the containers
   - Set up alerts for unusual activity or errors

#### Accessing the Application

Once the Docker containers are running, you can access the backend API at:
- http://localhost:3001/nav/values (for NAV values)
- http://localhost:3001/nav/latest/:fundAddress (for latest NAV value for a fund)

The PostgreSQL database is also accessible at:
- Host: localhost
- Port: 5432
- Username: postgres
- Password: postgres
- Database: rethink_db

## Configuration

A `.env.example` file is provided as a template. Copy it to create your own `.env` file:

```bash
cp .env.example .env
```

Then edit the `.env` file with your specific configuration values:

```
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=rethink_db

# Server Configuration
PORT=3001
```

## Running the Application

### Development Mode

```bash
npm run start:dev
```

### Production Mode

```bash
npm run start:prod
```

## API Endpoints

### Calculate NAV

Calculates the simulated NAV for a fund and stores it in the database.

- **URL**: `/nav/calculate`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "fundChainId": "ethereum",
    "fundAddress": "0x1234567890123456789012345678901234567890",
    "safeAddress": "0x1234567890123456789012345678901234567890",
    "baseDecimals": 18,
    "baseSymbol": "ETH",
    "navEntry": {
      "positionName": "WETH",
      "valuationSource": "Uniswap",
      "positionType": "liquid",
      "detailsHash": "0x1234567890123456789012345678901234567890123456789012345678901234",
      "details": {
        "liquid": [
          {
            "tokenPair": "0x1234567890123456789012345678901234567890"
          }
        ],
        "pastNAVUpdateIndex": "0",
        "pastNAVUpdateEntryIndex": "0"
      }
    },
    "isFundNonInit": false
  }
  ```
- **Response**:
  ```json
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "fundAddress": "0x1234567890123456789012345678901234567890",
    "fundChainId": "ethereum",
    "safeAddress": "0x1234567890123456789012345678901234567890",
    "simulatedNav": "1000000000000000000",
    "simulatedNavFormatted": "1 ETH",
    "baseDecimals": 18,
    "baseSymbol": "ETH",
    "detailsHash": "0x1234567890123456789012345678901234567890123456789012345678901234",
    "calculatedAt": "2023-01-01T00:00:00.000Z"
  }
  ```

### Get NAV Values

Retrieves NAV values for a fund based on query parameters.

- **URL**: `/nav/values`
- **Method**: `GET`
- **Query Parameters**:
  - `fundAddress` (required): The address of the fund
  - `fundChainId` (optional): The chain ID of the fund
  - `detailsHash` (optional): The hash of the NAV method details
  - `fromDate` (optional): Start date for filtering (ISO format)
  - `toDate` (optional): End date for filtering (ISO format)
- **Response**:
  ```json
  [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "fundAddress": "0x1234567890123456789012345678901234567890",
      "fundChainId": "ethereum",
      "safeAddress": "0x1234567890123456789012345678901234567890",
      "simulatedNav": "1000000000000000000",
      "simulatedNavFormatted": "1 ETH",
      "baseDecimals": 18,
      "baseSymbol": "ETH",
      "detailsHash": "0x1234567890123456789012345678901234567890123456789012345678901234",
      "calculatedAt": "2023-01-01T00:00:00.000Z"
    }
  ]
  ```

### Get NAV Value by ID

Retrieves a specific NAV value by its ID.

- **URL**: `/nav/values/:id`
- **Method**: `GET`
- **URL Parameters**:
  - `id`: The ID of the NAV value
- **Response**: Same as the single item in the array from the `/nav/values` endpoint

### Get Latest NAV Value for a Fund

Retrieves the latest NAV value for a fund.

- **URL**: `/nav/latest/:fundAddress`
- **Method**: `GET`
- **URL Parameters**:
  - `fundAddress`: The address of the fund
- **Response**: Same as the single item in the array from the `/nav/values` endpoint

## Scheduled Tasks

The backend automatically calculates NAV values for all configured funds every 5 minutes.

## Integration with Frontend

To integrate with the frontend, update the frontend code to call the backend API endpoints instead of directly calculating NAV values. For example:

```typescript
// Before: Direct calculation in frontend
await fundStore.fetchSimulatedNAVMethodValue(
  fundChainId,
  fundAddress,
  safeAddress,
  baseDecimals,
  baseSymbol,
  navEntry,
  isFundNonInit,
);

// After: Call backend API
const response = await fetch('http://localhost:3001/nav/calculate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fundChainId,
    fundAddress,
    safeAddress,
    baseDecimals,
    baseSymbol,
    navEntry,
    isFundNonInit,
  }),
});
const result = await response.json();
```
