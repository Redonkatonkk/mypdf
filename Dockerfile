# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Production image
FROM python:3.11-slim

WORKDIR /app

# Install nginx, supervisor, and curl (for health check)
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy version file
COPY VERSION.txt ./

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Create uploads directory with proper permissions
RUN mkdir -p /app/backend/uploads && chmod 777 /app/backend/uploads

# Configure nginx
RUN rm /etc/nginx/sites-enabled/default
COPY <<EOF /etc/nginx/sites-enabled/default
server {
    listen 7777;
    server_name localhost;

    # 允许上传大文件 (最大 100MB)
    client_max_body_size 100M;

    # Frontend static files
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # API proxy to backend
    location /api {
        proxy_pass http://127.0.0.1:7778;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # 超时设置
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;

        # 二进制文件传输优化（PDF等）
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Uploads static files
    location /uploads {
        proxy_pass http://127.0.0.1:7778;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

# Configure supervisor
COPY <<EOF /etc/supervisor/conf.d/app.conf
[supervisord]
nodaemon=true

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:backend]
command=python -m uvicorn main:app --host 0.0.0.0 --port 7778
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

# Expose ports
EXPOSE 7777 7778

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7778/health || exit 1

# Start supervisor
CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
