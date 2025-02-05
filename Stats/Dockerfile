# Use the official Python image as the base image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Expose the port that the application will run on
EXPOSE 8000

# Run gunicorn, with SSL certificate and key
# CMD ["gunicorn", "--certfile=/certificates/fullchain.pem", "--keyfile=/certificates/privkey.pem", "--bind", "0.0.0.0:8000", "mysite.wsgi:application"]
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "mysite.wsgi:application"]
