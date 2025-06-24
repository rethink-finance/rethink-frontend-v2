# Rethink Finance NAV Backend

This backend service calculates and stores simulated NAV (Net Asset Value) for funds in the Rethink Finance platform.

### TODO: 
- [ ] always check if in the database is the latest navUpdate for each fund, check current nav update index, if not refresh data
- [ ] use monorepo structure with shared functions and types, not doing this now because there is another big PR open for flows V2 which will cause a lot of conflicts now...
- [ ] optimize code

## Prerequisites

- Docker
- Docker Compose

## Installation

### Local Docker Installation

Make sure Docker and Docker Compose are installed.

This will start both the backend service and a PostgreSQL database:
```bash
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

#### Docker Volumes

The Docker Compose configuration uses the following volumes:

- `postgres_data`: Persists PostgreSQL database data
- `backend_node_modules`: Preserves the Node.js modules installed during the Docker build (development only)

These volumes ensure that data is persisted between container restarts and that the Node.js modules are properly managed.

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


## API Endpoints

### Get Latest NAV Value Snapshot for a Fund

Retrieves the latest simulated NAV value snapshot for a fund.

- **URL**: `/nav/latest/:fundAddress`
- **Method**: `GET`
- **URL Parameters**:
  - `fundAddress`: The address of the fund
- **Response**:
```shell
curl -X GET "http://localhost:8000/nav/latest-snapshot/0xBE0B0C435EA1156F76d3E116Fbd5606743ab179a?fundChainId=0x89" | jq --indent 2
```
```json
{
  "fundAddress": "0xBE0B0C435EA1156F76d3E116Fbd5606743ab179a",
  "fundChainId": "0x89",
  "navUpdateIndex": 13,
  "totalSimulatedNav": "25264607389577626885921",
  "totalSimulatedNavFormatted": "25,264.607389577626885921 DAI",
  "calculatedAt": "2025-06-24T15:25:01.299Z",
  "navUpdate": {
    "navUpdateIndex": 13,
    "safeAddress": "0xfcF577A1b4364a55Af6C48804C8fF4a8463d7dC0",
    "baseDecimals": 18,
    "baseSymbol": "DAI"
  },
  "navMethodValues": [
    {
      "detailsHash": "0x4582403edbbc4f40bea93d273274620463772abca66f1c2a4e5f491ff7e59a15",
      "simulatedNav": "12751461987054241994734",
      "simulatedNavFormatted": "12,751.461987054241994734 DAI",
      "calculatedAt": "2025-06-24T15:25:01.299Z",
      "createdAt": "2025-06-24T15:25:01.312Z"
    },
    {
      "detailsHash": "0x5d939e5a47115178611bddd5f9461d220ff2c27d946d7acbf1e65837e329c2c8",
      "simulatedNav": "3572192543652874928769",
      "simulatedNavFormatted": "3,572.192543652874928769 DAI",
      "calculatedAt": "2025-06-24T15:25:01.299Z",
      "createdAt": "2025-06-24T15:25:01.312Z"
    },
    {
      "detailsHash": "0x78876f1a3d4f20e3f5da31e43fee4b2e6f56e1dc2d79e3a9288bc56f45ec7c2d",
      "simulatedNav": "3828749370283584636799",
      "simulatedNavFormatted": "3,828.749370283584636799 DAI",
      "calculatedAt": "2025-06-24T15:25:01.299Z",
      "createdAt": "2025-06-24T15:25:01.312Z"
    },
    {
      "detailsHash": "0x18d74cdfe5c85776c280403b928e4e3c99957d8ca9356ac46592c35b499ca49e",
      "simulatedNav": "5112203488586925325619",
      "simulatedNavFormatted": "5,112.203488586925325619 DAI",
      "calculatedAt": "2025-06-24T15:25:01.299Z",
      "createdAt": "2025-06-24T15:25:01.312Z"
    }
  ]
}
```

## Scheduled Tasks

The backend automatically calculates NAV values snapshots for all configured funds every 5 minutes.


## Database & ORM

Create a new migration when changing/creating models.
```shell
npm run migration:generate -- src/migrations/<MigrationName>
```

Run/apply the migration to the database.
```shell
# Locally
npm run migration:run

# In the docker container (production)
docker compose exec backend npm run migration:run
```
