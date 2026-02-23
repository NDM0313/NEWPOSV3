FROM python:3.11-alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY injector.py .
ENV PORT=8080
EXPOSE 8080
CMD ["python3", "injector.py"]
