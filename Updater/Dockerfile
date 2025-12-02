FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy app directory and requirements
COPY app/ /app/app/
COPY requirements.txt /app/
COPY .env /app/
COPY app/cron/matches_updater_cron /etc/cron.d/matches_updater_cron

# Install cron, supervisor, and Python dependencies
RUN apt-get update && apt-get install -y cron supervisor && pip install -r requirements.txt

# Copy supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set permissions for cron job file
RUN chmod 0644 /etc/cron.d/matches_updater_cron

# Apply the cron job to cron's spool directory
RUN crontab /etc/cron.d/matches_updater_cron

# Start supervisor (which will run both cron and FastAPI)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]