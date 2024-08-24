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


## Development
### Icons
We are using [Iconify](https://iconify.design/docs/), and you can browse [icons here](https://icon-sets.iconify.design/?keyword=oc).

Usage example:
```vue
<Icon icon="octicon:question-16" width="1rem" />
```
### Show Test Funds
By default we do not show test funds.
To show test funds, you can set a variable to local storage:
```js
excludeTestFunds: false
```
To hide test funds you have to add them to the `excludeFundAddrs` in the `funds.store.ts`.

### Dev Notes
0) NAV update entires indices start with 1 instead of 0! **!IMPORTANT**
   used in:
   - getNavUpdateTime
   - getNavEntry
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
   - revokeDepositWithrawal


### TODO Create Contract TYPES (TypeScript)
Generate typescript files for contract to be used as return types then.

Example library: 
[ethereum-abi-types-generator](https://www.npmjs.com/package/ethereum-abi-types-generator)


# Stage Build
To create a stage build, run:
```shell
# Create .stage.env
touch .stage.env

# Populate it with:
BASE_DOMAIN="stage.rethink.finance"
# Make sure you use the correct wallet connect project id that has verified stage.rethink.finance domain
WALLET_CONNECT_PROJECT_ID="<insert_id>>"

npx nuxi generate --dotenv .stage.env
```
