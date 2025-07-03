FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy all Python files and requirements
COPY *.py /app/
COPY requirements.txt /app/
COPY .env /app/
COPY matches_updater_cron /etc/cron.d/matches_updater_cron

# Install cron and Python dependencies
RUN apt-get update && apt-get install -y cron && pip install -r requirements.txt

# Set permissions for cron job file
RUN chmod 0644 /etc/cron.d/matches_updater_cron

# Apply the cron job to cron's spool directory
RUN crontab /etc/cron.d/matches_updater_cron

# Apply the crontab and keep cron running in the foreground
CMD ["cron", "-f"]