ARG PHP_IMAGE
FROM ${PHP_IMAGE}
# Trusted runtime preparation only. No candidate source enters the build context.
RUN php -v && php -m && timeout --version \
    && apt-get update && apt-get install -y --no-install-recommends libfaketime \
    && dpkg-query -W libfaketime \
    && test -f /usr/share/doc/libfaketime/copyright \
    && if ! php -r 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);'; then \
         apt-get update && apt-get install -y --no-install-recommends libsqlite3-dev && docker-php-ext-install pdo_sqlite; \
       fi \
    && if ! php -r 'exit(extension_loaded("mbstring") ? 0 : 1);'; then \
         apt-get update && apt-get install -y --no-install-recommends libonig-dev && docker-php-ext-install mbstring; \
       fi \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work
