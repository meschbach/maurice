FROM node:13

ENV NODE_ENV production
RUN mkdir /app && chown -R node:node /app
WORKDIR /app
COPY package.json package-lock.json /app/
USER node
RUN npm install --production

USER root
COPY *.js /app/
USER node
CMD ["node","maurice.js"]
