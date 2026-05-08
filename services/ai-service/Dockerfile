# Use Python 3.10 slim (AWS Public ECR mirror — avoids Docker Hub rate limits in CI)
FROM public.ecr.aws/docker/library/python:3.10-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    SENTENCE_TRANSFORMERS_HOME=/app/.sentence_transformers \
    HF_HUB_DISABLE_XET=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies (torch CPU-only to keep image smaller)
RUN pip install --no-cache-dir torch==2.2.2 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# Pre-download the sentence-transformer embedding model (117 MB).
# This layer is cached independently of app code — rebuilding after code changes
# won't re-download the model.
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2'); \
print('Embedding model downloaded successfully')"

# Copy application code
COPY app/ ./app/

# Copy training pipeline
COPY training/ ./training/

# Create models directory and train all models at build time
RUN mkdir -p app/models \
    && python training/train_model.py \
    && python training/train_accept_model.py \
    && python training/train_wait_model.py

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "from urllib.request import urlopen; response = urlopen('http://localhost:8000/api/health'); raise SystemExit(0 if response.status == 200 else 1)" || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
