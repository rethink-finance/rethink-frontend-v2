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
# Use Node 18 (18.20.4)
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

## Production Build
Build and deploy to GH pages.
```shell
npx nuxi generate; cd .output/public/; git init; git add -A; git commit -m "deployment to GH Pages"; git push -f git@github.com:rethink-finance/rethink-frontend-v2.git master:gh-pages; cd ../..;
```


## Stage Build
To create a stage build, run:
```shell
# Create .env
touch .env

# Populate it with:
# Make sure you use the correct wallet connect project id that has verified stage.rethink.finance domain
WALLET_CONNECT_PROJECT_ID="<insert_id>>"

# Run
npm run build_stage
# or
npx BASE_DOMAIN=stage.rethink.finance nuxi generate
```

Make sure that `.htaccess` file has:
```txt
# Ensure the site serves the correct files for each route.
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Directly serve the index.html for the root
  RewriteRule ^index\.html$ - [L]

  # Only rewrite if the requested resource does not exist
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ /index.html [L]
</IfModule>
```


### Reader Contract TODO

1) Calculate Cumulative return in the reader contract for each fund. Special case if the totalDepositBal is 0, we must
take the first NAV update as the start value (TSHN - ShineDAO is such example on Polygon).
If there is no NAV update yet, cumulative return percent must be 0.

2) Calculate Total NAV like we do in the frontend. There is a special case if there are no NAV
updates yet, then the total NAV is actually totalDepositBal-


### Reader Contract TODO
1) Until the reader contract cumulative value is implemented:
   Special case if the totalDepositBal is 0, we must take
   the first NAV update as the start value (TSHN - ShineDAO is such example on Polygon)
   If there is no NAV update yet, cumulative return percent must be 0.
