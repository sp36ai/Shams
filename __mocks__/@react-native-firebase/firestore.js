const firestore = () => ({
  collection: () => ({
    doc: () => ({
      update: () => Promise.resolve(),
    }),
  }),
});
module.exports = firestore;
module.exports.default = firestore;
