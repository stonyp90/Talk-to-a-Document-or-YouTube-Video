FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 AS lambda-adapter
FROM python:3.12-slim
WORKDIR /app
COPY services/transcript/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/transcript/app.py services/transcript/test_app.py ./
RUN python -m unittest -v
COPY --from=lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter
ENV PORT=3010 AWS_LWA_PORT=3010 AWS_LWA_READINESS_CHECK_PATH=/health TRANSCRIPT_MODE=live PYTHONUNBUFFERED=1
CMD ["python", "app.py"]
