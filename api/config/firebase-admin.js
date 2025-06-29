const admin = require('firebase-admin');

const serviceAccount = {
  type: "service_account",
  project_id: "biztras-4a141",
  private_key_id: "9671cba43c82a7f18714fdbfbd20fdd6c9b60f9f",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC72udv7mzwMDps\nQ9eTS7WKzklMxzx2n9nOElebM8J9/9jHSVsGT3/Ld2ml+7eU3XDE2nrbFxg7xcil\nb6um7tY6Of7GClyS1hOVAAjzaT78N1cS6mN1IrPiDDnd98b+0joFUtJ7YbNaLqQi\nkvrbVAHt91bft8CP4ye0f8N2Cc1XiqiLT8+KToG7HB75wm5yOrhkHpkIwQxc+qJz\nbywkz8D+Akv3HO0lTz43JYZymIIYVwSQrEqrpwad3ifle/mKAmAYQy1wJmE8lo0t\neXHsyxpyRfib7E2ghVmT0IgfsL/EsGnuFH10zHIeB5f+mif5+1U36SwoeyHhT5gH\nEICZob5TAgMBAAECggEACp0hfWwBtgfA4p6/U+BaXKzaFwnyFcZjVnwn0f+N1Mj7\nVQsv0ZP1UFLUt8mYmO3IB39L+Laof7FllvSlGf9IQFhILPqnOgP5bZjnveUA54bd\nlxaCJxCeYZO3mJ3SyFFVcOPkkORiGfgk/ZpuAlgP7IOQjNRY1L23X8CQ6R7q/gVL\n2XGRKCuZqYIpFVs8X3xl9ZqyEyfHqWpV0KlzH8p4Ih2fEyuBies+/ve1Zqb81w2T\nrIYVrgtyvOzIB0ivaoOAVpl7B5h/I/e1drmzIHLNvzJuG+XlUe2dBBglFzHJJYoo\nzRZznzB3oLZZO5ZwLqPr7JIFAjJlFPY5MXRfrjTYHQKBgQDvmkORDCOJUwla0QVQ\nnbZ2nLNKcVrhTLHazGl+RosFDb/4Zz8FTNe1HdZmq/K5/65AHLUcP9TbtIagJT/d\nZ4YZWqk2Xxrigh7peVpxXdrbvJ4hnyEaMnSl5dzjDVtD2ryVrhwwPQW7NAnX7IIn\nTLFTcrBIO+dqsmBePKWXC+++jQKBgQDItgu66/MwYFehkRnS6s5LS+tqZPxbNwwB\nNWPVoMPtUaeKTDkSBhyareRLbwCGAsKkqpmRfAZJ0All5IcwhxWbk0qB0Vh2QAmX\nQIl7cwYUGTvxa8HRX1Iewdcf9fwuuUtAWbG150ixGBtSQ4C5s//pVM+CfBNy1DrK\n31CwVnQoXwKBgBssyucDknA7y77SICExkgVH5onV63HMKgvfzUM2KwRKt/ArfZlT\nSs/O74c7j08LMa8x0lS+5Jx6kB5PuzuYRzxO7QwuozT3fxwJ2HktJOpxLRoxGycG\ne/Zo6LGTzTsX7vWnBqlt8l12HHux5l0gtKf7RQUcTjXqv0VQ6ZMFFo7tAoGBAMXn\n4ycbsr53sNCpz4nOZz2NjYJqMv8KBzdF2rvxel+ODSJryDZCen/2iM3slNqO7DgL\n08LFRToQ/MNQlBDAkgjGMkhREOYAfLR8OVPVdh/pRdbmBsWZNNMJFUL5fQDhShcY\nmgcgF+gvOfligBIcL3F2Y+pox5CJPbN+gQRvKrgHAoGBALwuY3Bqhw8Nce1pAmYf\nay7sdLrVRFoKXy+q6TcfpVREcOTRUgm49eYNXYBx6Q7lS+tsek8ZmoCsj5UGDClH\nCc1cPjrfgP+EV4JTl/EgJc7E9bv05xmQ2jf6+fHaFeIEGbBfDmevnJog18c6GQJe\n0TUNHTsJsrvKnljraXd0rcOV\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@biztras-4a141.iam.gserviceaccount.com",
  client_id: "113355711694552959943",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40biztras-4a141.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "biztras-4a141"
    });
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
}

module.exports = admin;