FROM node:alpine3.12

WORKDIR /usr/src/p-to-z

COPY package*.json ./

ENV NPM_CONFIG_LOGLEVEL warn
RUN npm ci --only=production

COPY . .

CMD [ "npm", "start" ]