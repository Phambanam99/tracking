# Common routes for both HTTP and HTTPS

# API Backend - Main API endpoints
location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    
    proxy_pass http://backend;
    proxy_http_version 1.1;
    
    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-API-Version "1.0.0";
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # Buffering
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
}

# Auth endpoints with stricter rate limiting
location = /api/auth/login {
    limit_req zone=login_limit burst=3 nodelay;
    
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-API-Version "1.0.0";
}

location = /api/auth/register {
    limit_req zone=login_limit burst=3 nodelay;
    
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-API-Version "1.0.0";
}

# Uploads - Static files served by backend
location /uploads/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    
    # Cache uploaded images
    expires 30d;
    add_header Cache-Control "public, immutable";
    access_log off;
}

# Socket.IO WebSocket endpoint (namespace: /tracking)
location /socket.io/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket support
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Long timeouts for WebSocket connections
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
    
    # Disable buffering for WebSocket
    proxy_buffering off;
}

# Next.js Static Files - _next/static/
location /_next/static/ {
    proxy_pass http://frontend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    
    # Long cache for Next.js static assets (they have hash in filename)
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}

# Next.js Public Files - icons, images, etc.
location /icons/ {
    proxy_pass http://frontend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    
    expires 7d;
    add_header Cache-Control "public";
    access_log off;
}

# Static assets with caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$ {
    proxy_pass http://frontend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    
    expires 7d;
    add_header Cache-Control "public";
    access_log off;
}

# Frontend - Next.js application (must be last)
location / {
    proxy_pass http://frontend;
    proxy_http_version 1.1;
    
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket support for Next.js HMR (development)
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# Deny access to hidden files
location ~ /\. {
    deny all;
    access_log off;
    log_not_found off;
}
