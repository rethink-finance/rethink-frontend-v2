# Nuxt 3 Minimal Starter

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install the dependencies:

```bash
npm install
```

## Local Environment
Add the following environment variables to .env in the project root.
```bash
INFURA_KEY="<YOUR_INFURA_KEY>"
WALLET_CONNECT_PROJECT_ID="<YOUR_WALLET_CONNECT_PROJECT_ID>"
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
npm run dev
```

## Production

Build the application for production:

```bash
npm run build
```

Locally preview production build:

```bash
npm run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.



### Dev Notes
1) Problems using `web3-onboard`, fixed by upgrading package `rxjs`:
```js
import { init } from "@web3-onboard/vue"

// Upgrade package to:
//   "rxjs": "^7.8.1"
```
