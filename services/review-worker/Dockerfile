FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
# No EXPOSE needed as this is a background worker consuming from Kafka
CMD ["npm", "start"]
