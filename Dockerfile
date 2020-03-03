FROM node:13

RUN mkdir /app && chown -R node:node /app
WORKDIR /app
COPY package.json package-lock.json /app/
USER node
RUN npm install

USER root
COPY *.js /app/
USER node
CMD ["node","maurice.js"]
