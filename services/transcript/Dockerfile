FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py test_app.py ./
RUN python -m unittest -v && useradd --uid 10001 --create-home transcript
USER 10001
ENV PORT=3010 TRANSCRIPT_MODE=live PYTHONUNBUFFERED=1
EXPOSE 3010
HEALTHCHECK --interval=10s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:3010/health', timeout=2)"
CMD ["python", "app.py"]
