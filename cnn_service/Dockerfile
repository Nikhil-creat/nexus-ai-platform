FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 tesseract-ocr \
    && rm -rf /var/lib/apt/lists/* && useradd -m -u 10001 nexus
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
COPY cnn_extractor.py .
USER nexus
EXPOSE 8100
CMD ["uvicorn", "cnn_extractor:app", "--host", "0.0.0.0", "--port", "8100"]
