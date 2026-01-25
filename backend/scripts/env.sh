#!/bin/bash
# Shared environment setup for backend scripts

ENVIRONMENT="${ENVIRONMENT:-development}"

if [[ "${ENVIRONMENT}" == "production" ]]; then
  echo "Starting in production mode..."
  export NODE_ENV="production"
else
  echo "Starting in development mode..."
  export NODE_ENV="development"
fi

# DATABASE_URL must be set externally (PostgreSQL only)
if [[ -z "${DATABASE_URL}" ]]; then
  echo "Warning: DATABASE_URL is not set. Please set it in your environment or .env file."
fi
