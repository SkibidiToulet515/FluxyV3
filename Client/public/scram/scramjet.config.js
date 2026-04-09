/* Fluxy custom Scramjet config — overrides the stock /scramjet/ prefix */
self.__scramjet$config = {
  prefix: '/scram/',
  codec: self.__scramjet$codecs.plain,
  config: '/scram/scramjet.config.js',
  bundle: '/scram/scramjet.bundle.js',
  worker: '/scram/scramjet.worker.js',
  client: '/scram/scramjet.client.js',
  codecs: '/scram/scramjet.codecs.js',
};
