#!/bin/bash

# SSL Setup Script using Let's Encrypt
# Usage: ./setup-ssl.sh yourdomain.com

set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Usage: ./setup-ssl.sh yourdomain.com"
    exit 1
fi

echo "🔐 Setting up SSL for $DOMAIN"

# Install certbot if not exists
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot
fi

# Stop nginx temporarily
echo "Stopping nginx..."
docker compose -f docker-compose.prod.yml stop nginx

# Generate certificate
echo "Generating SSL certificate..."
sudo certbot certonly --standalone \
    --preferred-challenges http \
    --email admin@$DOMAIN \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Copy certificates to nginx ssl directory
echo "Copying certificates..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/key.pem
sudo chmod 644 nginx/ssl/cert.pem
sudo chmod 644 nginx/ssl/key.pem

# Update nginx config to enable SSL
echo "Enabling SSL in nginx config..."
sed -i 's/# ssl_certificate/ssl_certificate/g' nginx/conf.d/default.conf

# Start nginx
echo "Starting nginx..."
docker compose -f docker-compose.prod.yml start nginx

echo "✅ SSL setup complete for $DOMAIN"
echo ""
echo "📝 Remember to set up auto-renewal:"
echo "   sudo crontab -e"
echo "   Add: 0 0 1 * * certbot renew --quiet && ./setup-ssl.sh $DOMAIN"
