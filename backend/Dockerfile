# Use an official Python runtime as a parent image
FROM python:3.14-slim

# Set environment variables to prevent buffering issues with Python logging
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Install system dependencies including netcat for wait-for script
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python dependencies
# Using --no-cache-dir reduces image size
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application code into the container
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application using Uvicorn
# For production, consider using Gunicorn with Uvicorn workers:
# CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 