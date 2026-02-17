#!/bin/bash
# Curl Kong directly from host (Kong may be on docker network - use container)
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo"
# From a container that can reach Kong
docker exec erp-frontend wget -qO- --no-check-certificate \
  --method=POST \
  --body-data='{"email":"newuser'$(date +%s)'@test.com","password":"demo123"}' \
  --header='Content-Type: application/json' \
  --header="apikey: $ANON" \
  'http://supabase-kong:8000/auth/v1/signup' 2>&1
