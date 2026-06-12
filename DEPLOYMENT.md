# NexfordMarket Deployment

This project is a static frontend served by a small Node.js server. There is no build step and no npm dependency install is required.

## Files to Deploy

Upload the project contents except local logs and Git files:

```txt
assets/
auth.css
auth.js
contact.html
dashboard.html
index.html
login.html
package.json
script.js
server.js
signup.html
styles.css
```

The `backend/traders_backend_mongoDB` folder in this checkout is empty. Deploy your real backend separately.

## Frontend

Requirements:

```txt
Node.js 18 or newer
```

Run:

```bash
npm start
```

The server uses `PORT` if it is set, otherwise it starts from port `5500`.

Example:

```bash
PORT=5500 npm start
```

## Backend URL

The frontend reads the backend URL from `auth.js`.

Local development:

```txt
http://localhost:8084/traders-backend
```

Production default:

```txt
https://your-domain.com/traders-backend
```

For this default to work, configure your web server or reverse proxy so `/traders-backend` forwards to your backend application.

If your backend is on a different domain or path, define this before loading `auth.js` in `login.html`, `signup.html`, and `dashboard.html`:

```html
<script>
  window.NEXFORD_API_BASE_URL = "https://api.your-domain.com/traders-backend";
</script>
<script src="auth.js"></script>
```

## Nginx Example

```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5500;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /traders-backend/ {
        proxy_pass http://127.0.0.1:8084/traders-backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /traders-backend/ws {
        proxy_pass http://127.0.0.1:8084/traders-backend/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Quick Smoke Test

After deployment, visit:

```txt
https://your-domain.com/
https://your-domain.com/login.html
https://your-domain.com/signup.html
```

Then test login/signup with the backend running and confirm the browser network requests go to:

```txt
https://your-domain.com/traders-backend/api/auth/login
https://your-domain.com/traders-backend/api/auth/register
```
