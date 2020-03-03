FROM node:13

COPY package.json package-lock.json /app
RUN npm install

COPY *.js /app
CMD ["node","maurice.js"]
