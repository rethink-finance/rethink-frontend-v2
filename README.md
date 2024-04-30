# Nuxt 3 Minimal Starter

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.


### Tech Stack
- Vue3
- Typescript
- Nuxt3
- Pinia (state management)
- Vuetify


## Setup

Make sure to install the dependencies:

```bash
npm install
```

## Development Server

### Local Environment
Create the `.env` file in the project root.\
Add the following environment variables to `.env`.
```bash
INFURA_PROJECT_ID="<YOUR_INFURA_PROJECT_ID>"
INFURA_KEY="<YOUR_INFURA_KEY>"
WALLET_CONNECT_PROJECT_ID="<YOUR_WALLET_CONNECT_PROJECT_ID>"
```

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
2) Web3 store is initialized as a plugin in `plugins/web3.client.ts`.
3) There are many contract variable typos:
   - totalWithrawalBalance
   - revokeDepositWithrawal
   - performaceHurdleRateBps


### TODO Create Contract TYPES (TypeScript)
Generate typescript files for contract to be used as return types then.

Example library: 
[ethereum-abi-types-generator](https://www.npmjs.com/package/ethereum-abi-types-generator)
