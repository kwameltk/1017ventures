# Prince Enterprise portal

Public page for customers, plus an admin sign-in for the shop owner.

## Project structure

```text
.
|-- public/
|   `-- index.html          # Customer catalog and admin interface
|-- netlify/
|   `-- functions/
|       `-- api.mjs         # Product API, sign-in, and persistence
|-- netlify.toml            # Netlify publish and function settings
|-- package.json            # Local development command and dependencies
`-- README.md
```

Generated local files such as `node_modules/`, `.netlify/`, and `deno.lock` are not part of the project source.

## Run locally

Install dependencies with `npm install`, then start the site with `npm run dev`. Netlify Dev serves the site at `http://localhost:8888` and routes `/api/*` to the function.

## Deploy on Netlify
Drag and drop does not run server code, so use one of these:
1. GitHub: push this folder to a repo, then in Netlify choose Add new site > Import from Git. Build settings are read from netlify.toml.
2. CLI: `npm i -g netlify-cli`, then `netlify deploy --prod` from this folder.

## Set the admin password (required)
Site configuration > Environment variables, add:
- ADMIN_PASSWORD: the password Prince will type to sign in
- TOKEN_SECRET: any long random string (keeps sign-ins secure)
Then redeploy once so the function picks them up.

## Using it
Open the site, click "Admin sign in" at the bottom. Customers never see add, edit, sell, shelf value or sales.
Products are stored in Netlify Blobs, so the list is the same on every device.
