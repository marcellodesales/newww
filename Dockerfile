FROM node:0.10.33

# Prepare
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Use the cache for dependencies
COPY package.json /usr/src/app/

# If building behind an http_proxy, set them for git and npm
#RUN git config --global http.proxy http://qypprdproxy02.ie.company.net:80 && \
#    npm config set proxy http://qypprdproxy02.ie.company.net:80 && \
#    npm config set https-proxy http://qypprdproxy02.ie.company.net:80

# Install dependencies
RUN npm install

# Copy all the source
COPY . /usr/src/app

# Execute the dev steps
COPY ./numbat-config.example.js /usr/src/app/numbat-config.js
COPY ./.env.example /usr/src/app/.evn
RUN touch /usr/src/app/config.admin.js
