# AWS EC2 Deployment Steps (Ubuntu + Nginx)

Follow these steps closely to deploy QuizDeck on an Ubuntu EC2 instance with Nginx and PHP-FPM, using RDS (MySQL) and S3.

- Prereqs
  - EC2 Ubuntu 22.04/24.04 with security group allowing 80/443 and SSH 22 from your IP
  - RDS MySQL instance and S3 bucket ready
  - Domain pointing to EC2 public IP (A record)

1) SSH and base setup
- ssh -i <key.pem> ubuntu@<EC2_PUBLIC_IP>
- sudo apt update && sudo apt -y upgrade
- sudo apt -y install nginx php8.2-fpm php8.2-cli php8.2-mbstring php8.2-xml php8.2-curl php8.2-mysql php8.2-zip unzip git curl
- curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt -y install nodejs
- sudo npm i -g pm2 # optional for frontend serve, but we’ll use Nginx

2) Create app directories
- sudo mkdir -p /var/www/quizdeck
- sudo chown -R $USER:www-data /var/www/quizdeck

3) Upload project
- Clone or scp the repository into /var/www/quizdeck
- Ensure structure:
  - /var/www/quizdeck/backend
  - /var/www/quizdeck/frontend

4) Backend (Laravel) dependencies
- cd /var/www/quizdeck/backend
- sudo apt -y install composer || true
- composer install --no-dev --optimize-autoloader
- cp .env.production.example .env
- php artisan key:generate
- Edit .env with RDS, S3, APP_URL, SESSION_*, FILESYSTEM_DISK=s3
- php artisan migrate --force
- php artisan storage:link
- php artisan config:cache && php artisan route:cache && php artisan view:cache

5) Frontend (React) build
- cd /var/www/quizdeck/frontend
- npm ci || npm install
- cp .env.production.example .env.production
- Edit .env.production REACT_APP_API_BASE=https://your-domain.com
- npm run build

6) Nginx config
- sudo cp /var/www/quizdeck/backend/public/nginx-quizdeck.conf.example /etc/nginx/sites-available/quizdeck
- sudo sed -i 's#your-domain.com#your-domain.com#g' /etc/nginx/sites-available/quizdeck # adjust domain
- sudo ln -s /etc/nginx/sites-available/quizdeck /etc/nginx/sites-enabled/quizdeck || true
- sudo nginx -t && sudo systemctl reload nginx

7) PHP-FPM permissions
- sudo chown -R www-data:www-data /var/www/quizdeck/backend/storage /var/www/quizdeck/backend/bootstrap/cache
- sudo find /var/www/quizdeck/backend -type f -exec chmod 644 {} +
- sudo find /var/www/quizdeck/backend -type d -exec chmod 755 {} +

8) SSL (Certbot)
- sudo apt -y install certbot python3-certbot-nginx
- sudo certbot --nginx -d your-domain.com --agree-tos -m admin@your-domain.com --redirect -n
- sudo systemctl reload nginx

9) Health checks
- curl -I http://your-domain.com
- curl https://your-domain.com/api/health
- php /var/www/quizdeck/backend/artisan tinker --execute="DB::connection()->getPdo(); echo 'DB OK';"

10) Updates / redeploys
- Pull changes
- Rebuild frontend: cd frontend && npm run build
- Backend: composer install --no-dev --optimize-autoloader; php artisan migrate --force; php artisan config:cache route:cache view:cache
- sudo systemctl reload nginx

Notes
- Ensure CORS allowed_origins is restricted for production in backend/config/cors.php if necessary.
- If using Redis/ElastiCache, set REDIS_* in .env and switch CACHE_STORE/QUEUE/SESSION to redis.
- Logs: /var/log/nginx/error.log and backend/storage/logs/laravel.log
