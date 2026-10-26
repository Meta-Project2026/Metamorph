ARG PHP_IMAGE
FROM ${PHP_IMAGE}
# Trusted runtime preparation only. No candidate source enters the build context.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev libonig-dev coreutils \
    && if ! php -r 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);'; then docker-php-ext-install pdo_sqlite; fi \
    && if ! php -r 'exit(extension_loaded("mbstring") ? 0 : 1);'; then docker-php-ext-install mbstring; fi \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work
