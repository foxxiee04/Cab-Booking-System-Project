# Monitoring & Observability Stack

This directory contains configurations for the monitoring and observability stack of the Cab Booking System.

## Components

### Prometheus
- **URL**: http://localhost:9090
- **Purpose**: Metrics collection and alerting
- **Config**: `prometheus.yml`, `alert-rules.yml`

### Grafana
- **URL**: http://localhost:3300
- **Default credentials**: admin / admin123 (change via GRAFANA_PASSWORD env var)
- **Purpose**: Metrics visualization and dashboards
- **Dashboards**: Pre-configured dashboards in `grafana/dashboards/`

### Loki
- **URL**: http://localhost:3100
- **Purpose**: Log aggregation
- **Config**: `loki-config.yml`
- **Note**: API only, query via Grafana

### Promtail
- **Purpose**: Log collection agent
- **Config**: `promtail-config.yml`
- Collects logs from Docker containers and system logs

### Alertmanager
- **URL**: http://localhost:9093
- **Purpose**: Alert routing and notification
- **Config**: `alertmanager.yml`

## Quick Start

1. Start all services:
```bash
docker-compose up -d
```

2. Access Grafana:
- Open http://localhost:3300
- Login with admin/admin123
- Dashboards are auto-provisioned

3. Access Prometheus:
- Open http://localhost:9090
- Check targets: http://localhost:9090/targets
- Check alerts: http://localhost:9090/alerts

## Alert Configuration

Edit `alertmanager.yml` to configure notification channels:
- Email
- Slack
- Webhook (to notification-service)

Update placeholders:
- `YOUR_SLACK_WEBHOOK_URL`
- SMTP credentials for email alerts

## Custom Dashboards

Add custom dashboards to `grafana/dashboards/` in JSON format.
They will be automatically loaded on startup.

## Metrics Endpoints

Each service should expose metrics at `/metrics`:
- api-gateway:3000/metrics
- auth-service:3001/metrics
- ride-service:3002/metrics
- driver-service:3003/metrics
- payment-service:3004/metrics
- notification-service:3005/metrics

## Production Notes

- Change default Grafana password
- Configure proper SMTP settings for email alerts
- Set up Slack/PagerDuty integrations
- Enable authentication on Prometheus in production
- Configure retention policies for Prometheus and Loki
