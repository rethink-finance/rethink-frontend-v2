FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Copy the backend source code
COPY . .

RUN npm run build

EXPOSE 8000

CMD ["npm", "run", "dev"]
