#!/bin/bash
# BunkerNet Explorer - VPS Deployment Script
# Run on Ubuntu VPS with root/sudo access

set -e

echo "=== BunkerNet Explorer Setup ==="

# 1. Install Node.js 18+ if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 2. Install PostgreSQL if not present
if ! command -v psql &> /dev/null; then
    sudo apt-get install -y postgresql postgresql-contrib
fi

# 3. Create database and user
sudo -u postgres psql -c "CREATE USER bunker_explorer WITH PASSWORD 'bunker_explorer';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE bunker_explorer OWNER bunker_explorer;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE bunker_explorer TO bunker_explorer;" 2>/dev/null || true

# 4. Run schema migration
cd /opt/bunker-explorer/explorer-api
PGPASSWORD=bunker_explorer psql -h localhost -U bunker_explorer -d bunker_explorer -f db/schema.sql

# 5. Install dependencies
npm install --production

# 6. Copy frontend build
sudo mkdir -p /var/www/explorer.elbunkerbitcoin.com
sudo cp -r /opt/bunker-explorer/build /var/www/explorer.elbunkerbitcoin.com/

# 7. Install and configure PM2
sudo npm install -g pm2
cd /opt/bunker-explorer/explorer-api
pm2 delete bunker-explorer-api 2>/dev/null || true
pm2 start server.js --name bunker-explorer-api
pm2 save
pm2 startup

# 8. Configure Nginx
sudo cp /opt/bunker-explorer/deploy/nginx-explorer.conf /etc/nginx/sites-available/explorer.elbunkerbitcoin.com
sudo ln -sf /etc/nginx/sites-available/explorer.elbunkerbitcoin.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 9. SSL with Certbot
if command -v certbot &> /dev/null; then
    sudo certbot --nginx -d explorer.elbunkerbitcoin.com --non-interactive --agree-tos --email admin@elbunkerbitcoin.com
fi

echo "=== Setup Complete ==="
echo "Frontend: https://explorer.elbunkerbitcoin.com"
echo "API: https://explorer.elbunkerbitcoin.com/api/health"
