# HayQC Operations Runbook

## Quick Reference

| Service | Port | Health Check |
|---------|------|--------------|
| Backend API | 3000 | `GET /health` |
| Webapp | 80 | `GET /` |
| PostgreSQL | 5432 | `pg_isready` |

## Endpoints

### Health Checks

```bash
# Basic health (fast, no DB)
curl https://api.yourapp.com/health

# Readiness check (includes DB)
curl https://api.yourapp.com/health/ready

# Metrics (JSON)
curl https://api.yourapp.com/metrics

# Prometheus metrics
curl https://api.yourapp.com/metrics/prometheus
```

### Expected Responses

**Healthy:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "uptime": "3600s",
  "version": "1.0.0",
  "environment": "production"
}
```

**Degraded (DB issue):**
```json
{
  "status": "degraded",
  "checks": {
    "database": { "status": "error" }
  }
}
```

---

## Deployment

### Railway / Render (Recommended)

1. **Connect Repository**
   - Link your GitHub repo
   - Set root directory to `backend` or `webapp`

2. **Environment Variables**
   ```
   # Backend
   NODE_ENV=production
   DATABASE_URL=<from-platform>
   AUTH_SECRET=<generate-with-openssl-rand-base64-32>
   SENTRY_DSN=<optional>

   # Webapp
   VITE_BACKEND_URL=https://your-backend-url.com
   ```

3. **Build Commands**
   - Backend: Auto-detected from Dockerfile
   - Webapp: `npm run build`

4. **Start Commands**
   - Backend: `bun run src/index.ts`
   - Webapp: Serve `/dist` as static files

### Docker Deployment

```bash
# Development (with SQLite)
docker-compose up -d

# Production (with PostgreSQL)
export POSTGRES_PASSWORD="secure-password"
export AUTH_SECRET="your-32-char-secret"
export BACKEND_URL="https://api.yourapp.com"
docker-compose -f docker-compose.prod.yml up -d
```

---

## Database Operations

### Backups

```bash
# Manual backup
./scripts/backup-db.sh ./backups

# Automated backup (add to cron)
0 2 * * * /path/to/hayqc/scripts/backup-db.sh /path/to/backups
```

### Restore

```bash
# Restore from backup
./scripts/restore-db.sh ./backups/hayqc_backup_20240115_120000.sql.gz
```

### Migrations

```bash
# Development (schema push)
cd backend && bunx prisma db push

# Production (migrations)
cd backend && bunx prisma migrate deploy
```

---

## Monitoring

### Key Metrics to Watch

| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 1% | > 5% |
| P95 latency | > 500ms | > 2000ms |
| CPU usage | > 70% | > 90% |
| Memory usage | > 70% | > 90% |
| DB connections | > 80% pool | > 95% pool |

### Log Queries

**Find errors in last hour:**
```bash
# JSON logs (production)
cat logs/app.log | jq 'select(.level == "error")'

# CloudWatch/Datadog
level:error timestamp:[now-1h TO now]
```

**Slow requests (>1s):**
```bash
cat logs/app.log | jq 'select(.duration > 1000)'
```

**Requests by user:**
```bash
cat logs/app.log | jq 'select(.userId == "user123")'
```

### Alerting Rules (Prometheus/Grafana)

```yaml
# High error rate
- alert: HighErrorRate
  expr: rate(hayqc_errors_total[5m]) / rate(hayqc_requests_total[5m]) > 0.05
  for: 5m
  labels:
    severity: critical

# Slow response times
- alert: SlowResponses
  expr: hayqc_response_time_ms{quantile="0.95"} > 2000
  for: 10m
  labels:
    severity: warning

# Service down
- alert: ServiceDown
  expr: up{job="hayqc-backend"} == 0
  for: 1m
  labels:
    severity: critical
```

---

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to database"

**Symptoms:** 503 on `/health/ready`, connection errors in logs

**Check:**
```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check container
docker logs hayqc-db-prod
```

**Fix:**
- Verify DATABASE_URL format: `postgresql://user:pass@host:5432/db`
- Check network connectivity
- Restart database container

#### 2. "401 Unauthorized on all requests"

**Symptoms:** All authenticated endpoints return 401

**Check:**
```bash
# Verify AUTH_SECRET is set
echo $AUTH_SECRET | wc -c  # Should be > 32

# Check token in request
curl -v https://api.yourapp.com/api/users
```

**Fix:**
- Ensure AUTH_SECRET is consistent across restarts
- Clear browser cookies and re-login
- Check JWT expiration

#### 3. "Rate limit exceeded"

**Symptoms:** 429 responses, `Retry-After` header

**Check:**
```bash
# Check rate limit headers
curl -v https://api.yourapp.com/api/users 2>&1 | grep RateLimit
```

**Fix:**
- Wait for `Retry-After` seconds
- If legitimate traffic, increase limits in `rate-limit.ts`

#### 4. "CORS error"

**Symptoms:** Browser shows CORS errors, API works with curl

**Check:**
```bash
# Test CORS
curl -H "Origin: https://yourapp.com" -v https://api.yourapp.com/api/users
```

**Fix:**
- Add origin to `allowed` array in `index.ts`
- Ensure credentials: true is set

#### 5. "Prisma client not generated"

**Symptoms:** Routes return 404, health returns 200

**Fix:**
```bash
cd backend
bunx prisma generate
# Restart server
```

---

## Scaling

### Horizontal Scaling (Multiple Instances)

1. **Stateless Design** - App is already stateless (JWT tokens, no sessions)

2. **Database Connection Pooling**
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10
   ```

3. **Load Balancer Configuration**
   - Use `/health` for health checks
   - Session affinity not required

### Vertical Scaling

| Load Level | Backend | Database |
|------------|---------|----------|
| Light (<100 users) | 0.5 CPU, 256MB | 1 CPU, 1GB |
| Medium (<1000 users) | 1 CPU, 512MB | 2 CPU, 4GB |
| Heavy (>1000 users) | 2 CPU, 1GB | 4 CPU, 8GB |

---

## Security Checklist

- [ ] AUTH_SECRET is random 32+ characters
- [ ] DATABASE_URL uses SSL in production
- [ ] SENTRY_DSN set for error tracking
- [ ] Rate limiting enabled
- [ ] CORS restricted to known origins
- [ ] HTTPS enforced (HSTS header)
- [ ] Sensitive logs redacted (passwords, tokens)
- [ ] Database backups configured
- [ ] Secrets not in git (use .env.example)

---

## Emergency Procedures

### Rollback Deployment

```bash
# Railway/Render
# Use platform UI to rollback to previous deployment

# Docker
docker-compose down
docker-compose -f docker-compose.prod.yml up -d --pull never
```

### Database Recovery

```bash
# Stop application
docker-compose stop backend

# Restore from backup
./scripts/restore-db.sh ./backups/hayqc_backup_YYYYMMDD.sql.gz

# Run migrations
cd backend && bunx prisma migrate deploy

# Restart
docker-compose start backend
```

### Complete System Restart

```bash
# Graceful restart
docker-compose restart

# Full restart (clears state)
docker-compose down
docker-compose -f docker-compose.prod.yml up -d
```
