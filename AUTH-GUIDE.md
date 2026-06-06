# NexfordMarket Auth Frontend Connection Guide

The demo backend that was created earlier has been removed.

Your frontend now connects to a real backend using [auth.js](auth.js).

## Backend URL

Open [auth.js](auth.js) and check this line:

```js
const API_BASE_URL = window.location.port === "5000" ? "" : "http://localhost:5000";
```

If your pulled backend runs on another port, change it.

Examples:

```js
const API_BASE_URL = "http://localhost:8000";
```

or:

```js
const API_BASE_URL = "http://localhost:4000";
```

## Endpoints The Frontend Tries

The frontend tries common route names so it can work with different backend structures.

Signup:

```txt
/api/auth/signup
/api/auth/register
/api/users/register
```

Login:

```txt
/api/auth/login
/api/users/login
```

Current user profile:

```txt
/api/auth/me
/api/users/me
/api/user/profile
/api/users/profile
```

Logout:

```txt
/api/auth/logout
/api/users/logout
```

Admin users:

```txt
/api/admin/users
/api/users
```

## Token Names Supported

The login response can return token using any of these names:

```txt
accessToken
token
jwt
data.accessToken
data.token
```

The frontend stores the token in:

```txt
sessionStorage
```

or, if "Remember me" is checked:

```txt
localStorage
```

## User Object Names Supported

The profile response can return user data as:

```txt
user
data.user
data
profile
```

Supported user fields:

```txt
name
fullName
username
email
phone
mobile
role
```

## How To Test

1. Start your real backend.
2. Make sure `API_BASE_URL` in [auth.js](auth.js) matches the backend port.
3. Open `signup.html`.
4. Create an account.
5. Open `login.html`.
6. Log in.
7. You should be redirected to `dashboard.html`.

If signup or login fails, check your backend terminal and browser DevTools Network tab to see the exact endpoint and response.
